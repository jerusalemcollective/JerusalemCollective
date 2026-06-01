import { HostDashboardNav } from '@/components/host-dashboard-nav'
import { PaymentUpdateForm } from '@/components/payment-update-form'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { updateHostPaymentPreferences } from './actions'

type PaymentBooking = {
  id: string
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

export default async function HostPaymentsPage() {
  const { supabase, hostIds } = await requireHostDashboardAccess()
  const [{ data: profile }, { data: bookingsData }] = await Promise.all([
    supabase
      .from('host_payment_profiles')
      .select(
        'accepts_direct_payment, accepts_jlm_payment, direct_payment_instructions, preferred_currency, payout_currencies, stripe_account_id, payout_setup_status, stripe_charges_enabled, stripe_payouts_enabled',
      )
      .in('host_id', hostIds)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('bookings')
      .select(
        'id, check_in, check_out, payment_status, payment_notes, payment_updated_at, commission_percent, listings(title), profiles!bookings_user_id_fkey(full_name)',
      )
      .in('host_id', hostIds)
      .order('check_in', { ascending: false }),
  ])
  const bookings: PaymentBooking[] = (bookingsData || []).map((booking: PaymentBookingRow) => ({
    id: booking.id,
    check_in: booking.check_in,
    check_out: booking.check_out,
    payment_status: booking.payment_status,
    payment_notes: booking.payment_notes,
    payment_updated_at: booking.payment_updated_at,
    commission_percent: booking.commission_percent,
    listings: Array.isArray(booking.listings) ? booking.listings[0] || null : booking.listings || null,
    profiles: Array.isArray(booking.profiles) ? booking.profiles[0] || null : booking.profiles || null,
  }))

  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">
        <HostDashboardNav />

        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Host dashboard</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">Payment setup</h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            This is separate from listing your stay. Add your payment details here so you can receive payouts from bookings, and choose whether to also offer direct-to-host payment.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <form action={updateHostPaymentPreferences} className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="space-y-5">
              <div className="rounded-2xl bg-[#F8F5F2] p-4">
                <p className="font-bold text-stone-950">Receive online payments</p>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  Guests can pay JLM Collective online where enabled for a listing. JLM deducts the agency fee and sends your net payout in the currency received, where your payout account supports it.
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-2xl bg-[#F8F5F2] p-4">
                <input
                  type="checkbox"
                  name="acceptsJlm"
                  defaultChecked={profile?.accepts_jlm_payment || false}
                  className="mt-1"
                />
                <span>
                  <span className="block font-bold text-stone-950">Allow JLM Collective to collect payment</span>
                  <span className="mt-1 block text-sm leading-6 text-stone-600">
                    Guests can use Book now on listings where online payment is enabled. JLM Collective collects as agent and pays you the net amount in the currency received where supported.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-2xl bg-[#F8F5F2] p-4">
                <input
                  type="checkbox"
                  name="acceptsDirect"
                  defaultChecked={profile?.accepts_direct_payment || false}
                  className="mt-1"
                />
                <span>
                  <span className="block font-bold text-stone-950">Accept direct payment to me</span>
                  <span className="mt-1 block text-sm leading-6 text-stone-600">
                    Offer a host-direct route as an alternative where you handle the payment yourself.
                  </span>
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

              <label className="block">
                <span className="text-sm font-semibold text-stone-800">Direct payment instructions</span>
                <textarea
                  name="instructions"
                  defaultValue={profile?.direct_payment_instructions || ''}
                  rows={7}
                  placeholder="Explain how guests should pay you directly once a booking is approved."
                  className={`${inputClass} resize-y`}
                />
              </label>

              <div className="flex justify-end">
                <button className="rounded-full bg-[#c76f55] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#b85f47]">
                  Save payment settings
                </button>
              </div>
            </div>
          </form>

          <aside className="space-y-4">
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-stone-950">Payout setup</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Add your legal and bank details here when payout setup opens. This is not part of the stay listing form.
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <TextStatusRow label="Status" value={formatPayoutStatus(profile?.payout_setup_status)} />
                <StatusRow label="Payout profile created" value={Boolean(profile?.stripe_account_id)} />
                <StatusRow label="Charges enabled" value={profile?.stripe_charges_enabled || false} />
                <StatusRow label="Payouts enabled" value={profile?.stripe_payouts_enabled || false} />
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-stone-950">What comes next</h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                Next, JLM Collective will add a simple guided setup here so hosts can enter the details needed to receive money without handling that during the listing process.
              </p>
            </div>
          </aside>
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
    </main>
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

function StatusRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-stone-600">{label}</span>
      <span
        className={`rounded-full px-3 py-1 text-xs font-bold ${
          value ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-700'
        }`}
      >
        {value ? 'Yes' : 'Not yet'}
      </span>
    </div>
  )
}

function TextStatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-stone-600">{label}</span>
      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">
        {value}
      </span>
    </div>
  )
}

function formatPayoutStatus(status?: string | null) {
  if (status === 'ready') return 'Ready'
  if (status === 'pending') return 'Pending'
  if (status === 'restricted') return 'Needs attention'
  return 'Not started'
}

const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-[#c76f55]'
