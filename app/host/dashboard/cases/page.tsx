import { requireHostDashboardAccess } from '@/lib/host-dashboard'

type HostSupportCase = {
  id: string
  case_type: string
  status: string
  reason: string
  created_at: string
  requested_amount: number | null
  approved_refund_amount: number
  currency: string | null
  listings?: {
    title: string
  } | null
  guest?: {
    full_name: string | null
  } | null
}

type HostSupportCaseRow = Omit<HostSupportCase, 'listings' | 'guest'> & {
  listings?: HostSupportCase['listings'] | NonNullable<HostSupportCase['listings']>[] | null
  guest?: HostSupportCase['guest'] | NonNullable<HostSupportCase['guest']>[] | null
}

export default async function HostCasesPage() {
  const { supabase, hostIds } = await requireHostDashboardAccess()
  const { data } = await supabase
    .from('support_cases')
    .select(`
      id,
      case_type,
      status,
      reason,
      created_at,
      requested_amount,
      approved_refund_amount,
      currency,
      listings(title),
      guest:profiles!support_cases_guest_id_fkey(full_name)
    `)
    .in('host_id', hostIds)
    .order('created_at', { ascending: false })

  const cases: HostSupportCase[] = (data || []).map((supportCase: HostSupportCaseRow) => ({
    id: supportCase.id,
    case_type: supportCase.case_type,
    status: supportCase.status,
    reason: supportCase.reason,
    created_at: supportCase.created_at,
    requested_amount: supportCase.requested_amount,
    approved_refund_amount: supportCase.approved_refund_amount,
    currency: supportCase.currency,
    listings: Array.isArray(supportCase.listings)
      ? supportCase.listings[0] || null
      : supportCase.listings || null,
    guest: Array.isArray(supportCase.guest) ? supportCase.guest[0] || null : supportCase.guest || null,
  }))

  return (
    <div className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Host dashboard</p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-stone-950">Cases</h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            View dispute or refund cases connected to your stays.
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="grid gap-4 border-b border-stone-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-500 md:grid-cols-[1.2fr_0.9fr_0.8fr_0.8fr]">
            <span>Case</span>
            <span>Guest</span>
            <span>Status</span>
            <span>Refund</span>
          </div>

          {cases.length === 0 ? (
            <div className="px-6 py-12 text-center text-stone-500">No cases linked to your stays.</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {cases.map((supportCase) => (
                <article
                  key={supportCase.id}
                  className="grid gap-4 px-6 py-5 md:grid-cols-[1.2fr_0.9fr_0.8fr_0.8fr] md:items-center"
                >
                  <div>
                    <p className="font-bold text-stone-950">{supportCase.reason}</p>
                    <p className="mt-1 text-sm text-stone-500">
                      {supportCase.listings?.title || 'Stay'} | {supportCase.case_type.replaceAll('_', ' ')}
                    </p>
                  </div>
                  <p className="text-sm text-stone-700">{supportCase.guest?.full_name || 'Guest'}</p>
                  <StatusBadge status={supportCase.status} />
                  <p className="text-sm text-stone-700">
                    {supportCase.approved_refund_amount
                      ? `${supportCase.currency || ''} ${supportCase.approved_refund_amount.toLocaleString()} approved`
                      : supportCase.requested_amount
                        ? `${supportCase.currency || ''} ${supportCase.requested_amount.toLocaleString()} requested`
                        : 'None'}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === 'resolved'
      ? 'bg-green-100 text-green-700'
      : status === 'closed'
        ? 'bg-stone-100 text-stone-700'
        : status === 'under_review'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-rose-100 text-rose-700'

  return (
    <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold capitalize ${styles}`}>
      {status.replaceAll('_', ' ')}
    </span>
  )
}
