import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'
import { CasesList, type SupportCase } from './cases-list'
import { Pagination, normalizePaginationSearchParams, type PaginationSearchParams } from '@/components/pagination'
import { oneOrNull } from '@/lib/utils/one-or-null'

const PAGE_SIZE = 25

type SupportCaseRow = Omit<SupportCase, 'bookings' | 'listings' | 'guest' | 'host'> & {
  bookings?: SupportCase['bookings'] | NonNullable<SupportCase['bookings']>[] | null
  listings?: SupportCase['listings'] | NonNullable<SupportCase['listings']>[] | null
  guest?: SupportCase['guest'] | NonNullable<SupportCase['guest']>[] | null
  host?: SupportCase['host'] | NonNullable<SupportCase['host']>[] | null
}

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
      guest_response,
      host_response,
      bookings(id, stripe_checkout_session_id),
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

  const cases: SupportCase[] = (data || []).map((supportCase: SupportCaseRow) => ({
    ...supportCase,
    approved_refund_amount: supportCase.approved_refund_amount || 0,
    bookings: oneOrNull(supportCase.bookings),
    listings: oneOrNull(supportCase.listings),
    guest: oneOrNull(supportCase.guest),
    host: oneOrNull(supportCase.host),
  }))
  const total = count || 0

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Disputes & refunds</h2>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { label: 'All', value: 'all' },
          { label: 'Open', value: 'open' },
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

