import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'
import { CasesList, type SupportCase } from './cases-list'
import { summarizeSupportCases } from '@/lib/marketplace-rules'
import { Pagination, normalizePaginationSearchParams, type PaginationSearchParams } from '@/components/pagination'

const PAGE_SIZE = 25

function buildAdminUrl(
  basePath: string,
  currentParams: Record<string, string | undefined>,
  updates: Record<string, string>,
): string {
  const params = new URLSearchParams()
  Object.entries({
    ...currentParams,
    ...updates,
    page: '1',
  }).forEach(([key, value]) => {
    if (value && value !== 'all') {
      params.set(key, value)
    }
  })
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export default async function AdminCasesPage({
  searchParams,
}: {
  searchParams?: Promise<PaginationSearchParams>
}) {
  const { supabase } = await requireAdminPermission('cases')
  const currentSearchParams = normalizePaginationSearchParams(searchParams ? await searchParams : {})
  const statusFilter = currentSearchParams.status || 'all'
  const page = Math.max(1, Number(currentSearchParams.page) || 1)
  let casesQuery = supabase
    .from('support_cases')
    .select(`
      id,
      case_type,
      status,
      reason,
      requested_amount,
      approved_refund_amount,
      currency,
      resolution_notes,
      created_at,
      resolved_at,
      bookings(id),
      listings(id, title),
      guest:profiles!support_cases_guest_id_fkey(full_name),
      host:hosts!support_cases_host_id_fkey(name)
    `)
    .order('created_at', { ascending: false })

  let countQuery = supabase.from('support_cases').select('*', { count: 'exact', head: true })

  if (statusFilter !== 'all') {
    casesQuery = casesQuery.eq('status', statusFilter)
    countQuery = countQuery.eq('status', statusFilter)
  }

  const [{ data }, { count }] = await Promise.all([
    casesQuery.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    countQuery,
  ])

  const cases: SupportCase[] = (data || []).map((supportCase) => ({
    ...supportCase,
    approved_refund_amount: supportCase.approved_refund_amount || 0,
    bookings: Array.isArray(supportCase.bookings)
      ? supportCase.bookings[0] || null
      : supportCase.bookings,
    listings: Array.isArray(supportCase.listings)
      ? supportCase.listings[0] || null
      : supportCase.listings,
    guest: Array.isArray(supportCase.guest)
      ? supportCase.guest[0] || null
      : supportCase.guest,
    host: Array.isArray(supportCase.host)
      ? supportCase.host[0] || null
      : supportCase.host,
  }))
  const total = count || 0
  const summary = summarizeSupportCases(cases)

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Disputes & refunds</h2>
        <p className="mt-2 text-stone-600">
          Track guest issues, host responses, and any refund decision in one queue.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Open" value={summary.open} />
        <SummaryCard label="Under review" value={summary.underReview} />
        <SummaryCard label="Waiting on guest" value={summary.waitingOnGuest} />
        <SummaryCard label="Waiting on host" value={summary.waitingOnHost} />
      </div>

      <div className="mb-6 mt-8 flex flex-wrap gap-2">
        {[
          { label: 'All', value: 'all' },
          { label: 'Open', value: 'open' },
          { label: 'Under review', value: 'under_review' },
          { label: 'Waiting on guest', value: 'waiting_on_guest' },
          { label: 'Waiting on host', value: 'waiting_on_host' },
          { label: 'Resolved', value: 'resolved' },
          { label: 'Closed', value: 'closed' },
        ].map((option) => (
          <Link
            key={option.value}
            href={buildAdminUrl('/admin/cases', currentSearchParams, { status: option.value })}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              statusFilter === option.value
                ? 'bg-stone-950 text-white'
                : 'border border-stone-200 bg-white text-stone-700 hover:border-stone-300'
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>
      <CasesList cases={cases} />
      <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} basePath="/admin/cases" searchParams={currentSearchParams} />
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-stone-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-stone-950">{value}</p>
    </div>
  )
}

