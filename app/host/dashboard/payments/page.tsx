import { PaymentUpdateForm } from '@/components/payment-update-form'
import { DirectPaymentScheduleFields } from '@/components/direct-payment-schedule-fields'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { getPaymentRouteSettings } from '@/lib/platform-settings'
import { updateHostPaymentPreferences, confirmBookingDepositReceived } from './actions'

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
        'accepts_direct_payment, accepts_jlm_payment, direct_payment_instructions, preferred_currency, payout_currencies, stripe_account_id, payout_setup_status, stripe_charges_enabled, stripe_payouts_enabled, commission_percent_override',
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
    listings: Array.isArray(booking.listings) ? booking.listings[0] || null : booking.listings || null,
    profiles: Array.isArray(booking.profiles) ? booking.profiles[0] || null : booking.profiles || null,
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

  const effectiveCommissionPercent = profile?.commission_percent_override ?? paymentRoutes.commissionPercent
  const jlmPaymentDescription = getJlmPaymentDescription(effectiveCommissionPercent)

  return (
    <div className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">

        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Host dashboard</p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-stone-950">Payment setup</h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Choose how you receive payment for your bookings.
          </p>
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

        <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-stone-950">Your payouts</h2>
          </div>

          {payouts.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-[#F8F5F2] p-4 text-sm leading-6 text-stone-600">
              No payments yet.
            </p>
          ) : (
            <>
              {payoutSummary.map(([currency, totals]) => (
                <div key={currency} className="mt-5">
                  {payoutSummary.length > 1 && (
                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-500">
                      {currency}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-[#fff4ef] p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Due to you</p>
                      <p className="mt-1 text-2xl font-bold text-stone-950">
                        {formatMoney(totals.awaiting, currency)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#F8F5F2] p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Paid to you</p>
                      <p className="mt-1 text-2xl font-bold text-stone-950">
                        {formatMoney(totals.paid, currency)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#F8F5F2] p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Not due yet</p>
                      <p className="mt-1 text-2xl font-bold text-stone-950">
                        {formatMoney(totals.upcoming, currency)}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">Released after check-in</p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200">
                <div className="hidden gap-4 border-b border-stone-200 bg-[#fbfaf8] px-4 py-3 text-xs font-bold uppercase tracking-widest text-stone-500 md:grid md:grid-cols-[1fr_1fr_1fr_1.2fr]">
                  <span>Guest paid</span>
                  <span>JLM fee</span>
                  <span>Your payout</span>
                  <span>Status</span>
                </div>
                <div className="divide-y divide-stone-100">
                  {payouts.map((payment) => {
                    const currency = (payment.currency || 'USD').toUpperCase()
                    const payoutCurrency = (payment.host_payout_currency || currency).toUpperCase()
                    // "Guest paid" is the total collected: the deposit plus the
                    // balance once it has been paid, so it reconciles to payout + fee.
                    const guestPaid =
                      Number(payment.amount || 0) +
                      (payment.balance_status === 'paid' ? Number(payment.balance_amount || 0) : 0)

                    return (
                      <div
                        key={payment.id}
                        className="grid gap-2 px-4 py-4 text-sm md:grid-cols-[1fr_1fr_1fr_1.2fr] md:items-center"
                      >
                        <div>
                          <span className="font-semibold text-stone-950">
                            {formatMoney(guestPaid, currency)}
                          </span>
                          <span className="block text-xs text-stone-500">
                            {formatDate(payment.paid_at || payment.created_at)}
                          </span>
                        </div>
                        <span className="text-stone-600">
                          &minus;{formatMoney(Number(payment.platform_fee_amount || 0), currency)}
                        </span>
                        <span className="font-bold text-stone-950">
                          {formatMoney(Number(payment.host_payout_amount || 0), payoutCurrency)}
                        </span>
                        <div>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${payoutStatusTone(payment.payout_status)}`}
                          >
                            {payoutStatusLabel(payment.payout_status)}
                          </span>
                          {payment.payout_released_at && (
                            <span className="mt-1 block text-xs text-stone-500">
                              {formatDate(payment.payout_released_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <p className="mt-4 text-xs leading-5 text-stone-500">
                Payouts are sent to the bank details JLM Collective holds for you. If those need
                updating, message us rather than entering them here.
              </p>
            </>
          )}
        </section>

        <div>
          <form action={updateHostPaymentPreferences} className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="space-y-5">
              {paymentRoutes.jlmPaymentsEnabled && (
                <>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      name="acceptsJlm"
                      defaultChecked={profile?.accepts_jlm_payment || false}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-bold text-stone-950">Allow JLM Collective to collect payment</span>
                      <span className="mt-1 block text-sm leading-6 text-stone-600">
                        Guests can use Book now on listings where online payment is enabled. {jlmPaymentDescription}
                      </span>
                    </span>
                  </label>
                </>
              )}

              {!paymentRoutes.jlmPaymentsEnabled && (
                <input type="hidden" name="acceptsJlm" value="" />
              )}

              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="acceptsDirect"
                  defaultChecked={paymentRoutes.directPaymentsEnabled && (profile?.accepts_direct_payment || false)}
                  disabled={!paymentRoutes.directPaymentsEnabled}
                  className="mt-1"
                />
                <span>
                  <span className="block font-bold text-stone-950">Accept direct payment to me</span>
                  <span className="mt-1 block text-sm leading-6 text-stone-600">
                    Offer a host-direct route as an alternative where you handle the payment yourself.
                  </span>
                  {!paymentRoutes.directPaymentsEnabled && (
                    <span className="mt-2 block rounded-xl bg-white px-3 py-2 text-xs font-semibold text-amber-700">
                      Direct-to-host payments are currently paused by JLM Collective.
                    </span>
                  )}
                </span>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-stone-800">Preferred currency</span>
                <select
                  name="preferredCurrency"
                  defaultValue={profile?.preferred_currency || 'USD'}
                  className={inputClass}
                >
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                  <option value="ILS">ILS</option>
                </select>
              </label>

              <div>
                <p className="text-sm font-semibold text-stone-800">Currencies you can receive</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  {['GBP', 'USD', 'EUR', 'ILS'].map((currency) => (
                    <label key={currency} className="flex items-center gap-2 rounded-2xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-700">
                      <input
                        type="checkbox"
                        name="payoutCurrencies"
                        value={currency}
                        defaultChecked={(profile?.payout_currencies || []).includes(currency)}
                      />
                      {currency}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-stone-500">
                  JLM Collective will aim to pay you in the same currency the guest paid, if you can receive that currency.
                </p>
              </div>

              <DirectPaymentScheduleFields
                defaultValue={profile?.direct_payment_instructions}
                currency={profile?.preferred_currency || 'USD'}
              />

              <div className="flex justify-end">
                <button className="rounded-full bg-[#252525] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#111111]">
                  Save payment settings
                </button>
              </div>
            </div>
          </form>

        </div>

        <section className="mt-8 overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="border-b border-stone-100 px-6 py-4">
            <h2 className="text-lg font-bold text-stone-950">Booking payment tracking</h2>
            <p className="mt-1 text-sm text-stone-600">
              Track off-platform payments for your confirmed bookings.
            </p>
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
                  {booking.status === 'pending' && (
                    <form action={confirmBookingDepositReceived} className="mt-4 rounded-2xl bg-amber-50 p-4">
                      <p className="text-sm font-semibold text-amber-800">
                        Awaiting deposit — the dates aren&apos;t blocked until you confirm.
                      </p>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <button className="mt-3 rounded-full bg-[#252525] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#111111]">
                        Mark deposit received &amp; confirm booking
                      </button>
                    </form>
                  )}
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

function getJlmPaymentDescription(commissionPercent: number) {
  if (commissionPercent > 0) {
    return `JLM Collective collects payment as agent, deducts the ${formatCommission(commissionPercent)} admin fee, and pays you in the currency received where your payout account supports it.`
  }

  return 'JLM Collective collects payment as agent. At the moment JLM Collective is not charging hosts a platform fee, so payouts are handled in the currency received where your payout account supports it.'
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

function payoutStatusLabel(status?: string | null) {
  if (status === 'paid') return 'Paid to you'
  if (status === 'scheduled') return 'Payout scheduled'
  if (status === 'ready') return 'Due to you'
  if (status === 'cancelled') return 'Cancelled'
  return 'Not due yet'
}

function payoutStatusTone(status?: string | null) {
  if (status === 'paid') return 'bg-green-100 text-green-800'
  if (status === 'scheduled' || status === 'ready') return 'bg-[#fff4ef] text-[#c76f55]'
  if (status === 'cancelled') return 'bg-stone-100 text-stone-500'
  return 'bg-stone-100 text-stone-700'
}

const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]'
