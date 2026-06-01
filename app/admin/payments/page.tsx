import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { getPaymentRouteSettings } from '@/lib/platform-settings'

type PaymentRow = {
  id: string
  booking_id: string | null
  host_id: string
  guest_id: string
  payment_mode: string
  payment_method: string | null
  currency: string
  amount: number
  platform_fee_amount: number
  processor_fee_amount: number
  host_payout_amount: number
  host_payout_currency: string | null
  fx_rate_used: number | null
  status: string
  payout_status: string
  stripe_checkout_session_id?: string | null
  created_at: string
  hosts?: { name: string | null; email: string | null } | null
  profiles?: { full_name: string | null; email: string | null } | null
}

type PaymentQueryRow = Omit<PaymentRow, 'hosts' | 'profiles'> & {
  hosts?: PaymentRow['hosts'] | NonNullable<PaymentRow['hosts']>[] | null
  profiles?: PaymentRow['profiles'] | NonNullable<PaymentRow['profiles']>[] | null
}

export default async function AdminPaymentsPage() {
  const { supabase, adminRole } = await requireAdmin()

  if (adminRole !== 'owner') {
    redirect('/admin')
  }

  const [{ data }, paymentRoutes] = await Promise.all([
    supabase
      .from('booking_payments')
      .select(
        'id, booking_id, host_id, guest_id, payment_mode, payment_method, currency, amount, platform_fee_amount, processor_fee_amount, host_payout_amount, host_payout_currency, fx_rate_used, status, payout_status, stripe_checkout_session_id, created_at, hosts(name, email), profiles(full_name, email)',
      )
      .order('created_at', { ascending: false })
      .limit(100),
    getPaymentRouteSettings(),
  ])

  const payments: PaymentRow[] = (data || []).map((payment: PaymentQueryRow) => ({
    ...payment,
    hosts: Array.isArray(payment.hosts) ? payment.hosts[0] || null : payment.hosts || null,
    profiles: Array.isArray(payment.profiles) ? payment.profiles[0] || null : payment.profiles || null,
  }))

  const paidPayments = payments.filter((payment) => payment.status === 'paid')
  const totalGross = paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const totalHostPayout = paidPayments.reduce((sum, payment) => sum + Number(payment.host_payout_amount || 0), 0)
  const totalJlmFee = paidPayments.reduce((sum, payment) => sum + Number(payment.platform_fee_amount || 0), 0)

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
          Owner payments
        </p>
        <h1 className="mt-2 text-3xl font-bold text-stone-950">
          Payment control
        </h1>
        <p className="mt-2 max-w-2xl text-stone-600">
          Track JLM-collected payments, direct payment records, host net payout, and payout currency.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="JLM payments" value={paymentRoutes.jlmPaymentsEnabled ? 'Enabled' : 'Off'} />
        <Metric title="Direct payments" value={paymentRoutes.directPaymentsEnabled ? 'Enabled' : 'Off'} />
        <Metric title="Paid gross" value={formatMoney(totalGross)} />
        <Metric title="Host net due" value={formatMoney(totalHostPayout)} />
      </section>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-950">Recent payments</h2>
            <p className="mt-1 text-sm text-stone-600">
              Same-currency payout is shown by comparing paid currency and host payout currency.
            </p>
          </div>
          <Link
            href="/admin/settings"
            className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold text-stone-700 transition hover:border-stone-300"
          >
            Payment switches
          </Link>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-stone-100">
          <div className="grid gap-4 border-b border-stone-100 bg-stone-50 px-4 py-3 text-xs font-bold uppercase tracking-widest text-stone-400 md:grid-cols-[1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr]">
            <span>Payment</span>
            <span>Host</span>
            <span>Guest</span>
            <span>Gross</span>
            <span>Host net</span>
            <span>Status</span>
          </div>
          {payments.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-stone-500">
              No payment records yet.
            </p>
          ) : (
            <div className="divide-y divide-stone-100">
              {payments.map((payment) => (
                <article
                  key={payment.id}
                  className="grid gap-4 px-4 py-4 text-sm md:grid-cols-[1fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr]"
                >
                  <div>
                    <p className="font-bold text-stone-950">{payment.payment_mode.replaceAll('_', ' ')}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {new Date(payment.created_at).toLocaleDateString('en-GB')}
                    </p>
                    {payment.stripe_checkout_session_id && (
                      <p className="mt-1 truncate text-xs text-stone-400">
                        {payment.stripe_checkout_session_id}
                      </p>
                    )}
                  </div>
                  <p className="text-stone-700">{payment.hosts?.name || payment.hosts?.email || 'Host'}</p>
                  <p className="text-stone-700">{payment.profiles?.full_name || payment.profiles?.email || 'Guest'}</p>
                  <p className="font-semibold text-stone-950">
                    {formatCurrency(payment.amount, payment.currency)}
                  </p>
                  <p className="font-semibold text-stone-950">
                    {formatCurrency(payment.host_payout_amount, payment.host_payout_currency || payment.currency)}
                    {payment.fx_rate_used ? (
                      <span className="mt-1 block text-xs font-normal text-amber-700">FX used</span>
                    ) : (
                      <span className="mt-1 block text-xs font-normal text-green-700">No FX</span>
                    )}
                  </p>
                  <div>
                    <StatusBadge label={payment.status} />
                    <p className="mt-2 text-xs text-stone-500">Payout: {payment.payout_status}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-stone-400">
          Paid JLM fee total: {formatMoney(totalJlmFee)}. Mixed-currency totals are indicative only; use per-payment currency rows for reconciliation.
        </p>
      </section>
    </div>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-stone-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-stone-950">{value}</p>
    </article>
  )
}

function StatusBadge({ label }: { label: string }) {
  const isGood = label === 'paid'
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${isGood ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
      {label.replaceAll('_', ' ')}
    </span>
  )
}

function formatCurrency(amount: number, currency: string) {
  return `${currency.toUpperCase()} ${Number(amount || 0).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatMoney(amount: number) {
  return Number(amount || 0).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
