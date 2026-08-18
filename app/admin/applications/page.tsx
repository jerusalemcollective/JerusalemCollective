import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'
import { StatusBadge } from '@/components/status-badge'
import { Pagination, normalizePaginationSearchParams, type PaginationSearchParams } from '@/components/pagination'

const PAGE_SIZE = 25

type ApplicationRow = {
  id: string
  host_name: string
  apartment_title: string
  area: string
  status: string
  created_at: string
  rejected_at: string | null
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

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams?: Promise<PaginationSearchParams>
}) {
  const { supabase } = await requireAdminPermission('applications')
  const currentSearchParams = normalizePaginationSearchParams(searchParams ? await searchParams : {})
  const statusFilter = currentSearchParams.status || 'all'
  const page = Math.max(1, Number(currentSearchParams.page) || 1)

  // The default "All" view is a work queue: only open applications. Approved and
  // rejected are terminal states, reachable via their own filter chips as history.
  const OPEN_STATUSES = ['new', 'in_review', 'changes_requested']

  let applicationsQuery = supabase
    .from('host_applications')
    .select('id, host_name, apartment_title, area, status, created_at, rejected_at')
    .order('created_at', { ascending: false })
  let countQuery = supabase
    .from('host_applications')
    .select('*', { count: 'exact', head: true })

  if (statusFilter === 'all') {
    applicationsQuery = applicationsQuery.in('status', OPEN_STATUSES)
    countQuery = countQuery.in('status', OPEN_STATUSES)
  } else {
    applicationsQuery = applicationsQuery.eq('status', statusFilter)
    countQuery = countQuery.eq('status', statusFilter)
  }

  const [{ data }, { count }] = await Promise.all([
    applicationsQuery.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    countQuery,
  ])

  const applications: ApplicationRow[] = (data || []).map((application: ApplicationRow) => ({
    id: application.id,
    host_name: application.host_name,
    apartment_title: application.apartment_title,
    area: application.area,
    status: application.status,
    created_at: application.created_at,
    rejected_at: application.rejected_at,
  }))
  const total = count || 0

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Applications</h2>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { label: 'All', value: 'all' },
          { label: 'New', value: 'new' },
          { label: 'In review', value: 'in_review' },
          { label: 'Changes requested', value: 'changes_requested' },
          { label: 'Approved', value: 'approved' },
          { label: 'Rejected', value: 'rejected' },
        ].map((option) => (
          <Link
            key={option.value}
            href={buildAdminUrl('/admin/applications', currentSearchParams, { status: option.value })}
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

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="grid grid-cols-[1.3fr_1fr_0.8fr_0.7fr] gap-4 border-b border-stone-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-500">
          <span>Application</span>
          <span>Area</span>
          <span>Status</span>
          <span>Submitted</span>
        </div>

        {applications.length === 0 ? (
          <div className="px-6 py-12 text-center text-stone-500">No applications yet.</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {applications.map((application) => (
              <Link
                key={application.id}
                href={`/admin/applications/${application.id}`}
                className="grid grid-cols-1 gap-3 px-6 py-5 transition hover:bg-stone-50 md:grid-cols-[1.3fr_1fr_0.8fr_0.7fr] md:items-center"
              >
                <div>
                  <p className="font-bold text-stone-950">{application.apartment_title}</p>
                  <p className="mt-1 text-sm text-stone-500">{application.host_name}</p>
                </div>
                <p className="text-sm text-stone-700">{application.area}</p>
                <div>
                  <StatusBadge status={application.status} scheme="application" />
                </div>
                <p className="text-sm text-stone-500">
                  {new Date(application.created_at).toLocaleDateString('en-GB')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} basePath="/admin/applications" searchParams={currentSearchParams} />
    </div>
  )
}

