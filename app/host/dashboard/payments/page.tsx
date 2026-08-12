import { PaymentUpdateForm } from '@/components/payment-update-form'
import { HostGetPaidSection } from '@/components/host-get-paid-section'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { getPaymentRouteSettings } from '@/lib/platform-settings'
import { oneOrNull } from '@/lib/utils/one-or-null'
import { resolveHostPayout } from '@/lib/direct-payment'
import { updateHostPaymentPreferences } from './actions'

type PaymentBooking = {
  id: string
  status: string | null
  check_in: string
  check_out: string
  payment_status: string | null
  payment_notes: string | null
  payment_updated_at: string | null
  commission_percent: number | null
  listings: { title: string } | null
  profiles: { full_name: string | null } | null
}

type PaymentBookingRow = Omit<PaymentBooking, 'listings' | 'profiles'> & {
  listings?: PaymentBooking['listings'] | NonNullable<PaymentBooking['listings']>[] | null
  profiles?: PaymentBooking['profiles'] | NonNullable<PaymentBooking['profiles']>[] | null
}

type HostPaymentProfile = {
  accepts_direct_payment: boolean | null
  accepts_jlm_payment: boolean | null
  direct_payment_instructions: string | null
  preferred_currency: string | null
  payout_currencies: string[] | null
  stripe_account_id: string | null
  payout_setup_status: string | null
  stripe_charges_enabled: boolean | null
  stripe_payouts_enabled: boolean | null
  commission_percent_override: number | null
  payout_method: string | null
  payout_details: unknown
}

export default async function HostPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const { saved } = await searchParams
  const { supabase, hostIds } = await requireHostDashboardAccess()
  const [{ data: profile }, { data: bookingsData }, paymentRoutes, { data: payoutRows }] = await Promise.all([
    supabase
      .from('host_payment_profiles')
      .select(
        'accepts_direct_payment, accepts_jlm_payment, direct_payment_instructions, preferred_currency, payout_currencies, stripe_account_id, payout_setup_status, stripe_charges_enabled, stripe_payouts_enabled, commission_percent_override, payout_method, payout_details',
      )
      .in('host_id', hostIds)
      .limit(1)
      .maybeSingle<HostPaymentProfile>(),
    supabase
      .from('bookings')
      .select(
        'id, status, check_in, check_out, payment_status, payment_notes, payment_updated_at, commission_percent, listings(title), profiles!bookings_user_id_fkey(full_name)',
      )
      .in('host_id', hostIds)
      .order('check_in', { ascending: false }),
    getPaymentRouteSettings(),
    supabase
      .from('booking_payments')
      .select(
        'id, booking_id, amount, currency, platform_fee_amount, host_payout_amount, host_payout_currency, status, payout_status, paid_at, payout_released_at, created_at, balance_amount, balance_status',
      )
      .in('host_id', hostIds)
      // A row is created before the guest reaches Stripe, so every abandoned
      // checkout leaves a 'pending' row behind. Those are not real payments and
      // must not appear as money owed.
      .neq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50),
  ])
  const bookings: PaymentBooking[] = (bookingsData || []).map((booking: PaymentBookingRow) => ({
    id: booking.id,
    status: booking.status,
    check_in: booking.check_in,
    check_out: booking.check_out,
    payment_status: booking.payment_status,
    payment_notes: booking.payment_notes,
    payment_updated_at: booking.payment_updated_at,
    commission_percent: booking.commission_percent,
    listings: oneOrNull(booking.listings),
    profiles: oneOrNull(booking.profiles),
  }))
  const payouts: HostPayout[] = (payoutRows || []) as HostPayout[]

  // Totals are grouped by currency: a host paid in both USD and ILS must never
  // see the two added together.
  const totalsByCurrency = new Map<string, PayoutTotals>()
  payouts.forEach((payment) => {
    if (payment.payout_status === 'cancelled') return

    const currency = (payment.host_payout_currency || payment.currency || 'USD').toUpperCase()
    const totals = totalsByCurrency.get(currency) || { awaiting: 0, paid: 0, upcoming: 0 }
    const value = Number(payment.host_payout_amount || 0)

    if (payment.payout_status === 'paid') totals.paid += value
    else if (payment.payout_status === 'ready' || payment.payout_status === 'scheduled') totals.awaiting += value
    else totals.upcoming += value

    totalsByCurrency.set(currency, totals)
  })
  const payoutSummary = Array.from(totalsByCurrency.entries())

  return (
    <div className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">

        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Host dashboard</p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-stone-950">Payments</h1>
        </div>

        {saved === '1' && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800"
          >
            Payment settings saved.
          </div>
        )}
        {saved === 'error' && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            We couldn’t save your payment settings. Please try again.
          </div>
        )}

        <div className="mb-6 rounded-3xl bg-[#fdece5] p-6">
          <h2 className="font-display text-xl font-bold text-stone-950">Money from your bookings</h2>
          {payouts.length === 0 ? (
            <p className="mt-3 text-sm text-stone-600">No payments yet.</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-x-12 gap-y-4">
              {payoutSummary.map(([currency, totals]) => (
                <div key={currency}>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                    Due to you{payoutSummary.length > 1 ? ` · ${currency}` : ''}
                  </p>
                  <p className="mt-1 text-3xl font-bold text-stone-950">
                    {formatMoney(totals.awaiting, currency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <form action={updateHostPaymentPreferences}>
          <HostGetPaidSection
            payoutCurrenciesDefault={profile?.payout_currencies || []}
            initialCurrency={profile?.preferred_currency || 'USD'}
            jlmPaymentsEnabled={paymentRoutes.jlmPaymentsEnabled}
            acceptsJlmDefault={profile?.accepts_jlm_payment || false}
            directPaymentsEnabled={paymentRoutes.directPaymentsEnabled}
            acceptsDirectDefault={paymentRoutes.directPaymentsEnabled && (profile?.accepts_direct_payment || false)}
            stripe={{
              chargesEnabled: profile?.stripe_charges_enabled ?? false,
              payoutsEnabled: profile?.stripe_payouts_enabled ?? false,
              hasAccount: Boolean(profile?.stripe_account_id),
            }}
            payoutDefault={resolveHostPayout(profile?.payout_details, profile?.direct_payment_instructions)}
            scheduleDefault={profile?.direct_payment_instructions}
          />

          <div className="mt-4 flex justify-end">
            <button className="rounded-full bg-[#252525] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#111111]">
              Save payment settings
            </button>
          </div>
        </form>

        <section className="mt-8 overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="border-b border-stone-100 px-6 py-4">
            <h2 className="text-lg font-bold text-stone-950">Booking payment tracking</h2>
          </div>

          {bookings.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-stone-500">
              Confirmed bookings will appear here once guests book your stay.
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {bookings.map((booking) => (
                <div key={booking.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-stone-950">
                        {booking.listings?.title || 'Stay'}
                      </p>
                      <p className="mt-1 text-sm text-stone-500">
                        {booking.profiles?.full_name || 'Guest'} · {formatDate(booking.check_in)} to{' '}
                        {formatDate(booking.check_out)}
                      </p>
                      <p className="mt-1 text-sm font-medium text-stone-600">
                        JLM Collective commission: {formatCommission(booking.commission_percent)} for this booking
                      </p>
                    </div>
                    <PaymentStatusBadge status={booking.payment_status || 'unpaid'} />
                  </div>
                  <PaymentUpdateForm
                    bookingId={booking.id}
                    currentStatus={booking.payment_status || 'unpaid'}
                    currentNotes={booking.payment_notes}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  )
}

function PaymentStatusBadge({ status }: { status: string }) {
  const styles =
    status === 'paid_in_full'
      ? 'bg-green-100 text-green-700'
      : status === 'deposit_received'
        ? 'bg-amber-100 text-amber-700'
        : status === 'refunded'
          ? 'bg-stone-100 text-stone-700'
          : 'bg-rose-100 text-rose-700'

  const labels: Record<string, string> = {
    unpaid: 'Unpaid',
    deposit_received: 'Deposit received',
    paid_in_full: 'Paid in full',
    refunded: 'Refunded',
  }

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${styles}`}>
      {labels[status] || status}
    </span>
  )
}

function formatCommission(value: number | null) {
  if (value === null) return '0%'
  return `${value.toLocaleString('en-GB', {
    maximumFractionDigits: 2,
  })}%`
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

type HostPayout = {
  id: string
  booking_id: string | null
  amount: number | null
  currency: string | null
  platform_fee_amount: number | null
  host_payout_amount: number | null
  host_payout_currency: string | null
  status: string | null
  payout_status: string | null
  paid_at: string | null
  payout_released_at: string | null
  created_at: string
  balance_amount: number | null
  balance_status: string | null
}

type PayoutTotals = {
  awaiting: number
  paid: number
  upcoming: number
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

