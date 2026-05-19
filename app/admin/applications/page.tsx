import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'
import { StatusBadge } from '@/components/status-badge'
import { Pagination } from '@/components/pagination'

const PAGE_SIZE = 25

type ApplicationRow = {
  id: string
  host_name: string
  apartment_title: string
  area: string
  status: string
  verification_status: string
  created_at: string
}

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { supabase } = await requireAdminPermission('applications')
  const page = Math.max(1, Number((await searchParams).page) || 1)
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from('host_applications')
      .select('id, host_name, apartment_title, area, status, verification_status, created_at')
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('host_applications').select('*', { count: 'exact', head: true }),
  ])

  const applications = (data || []) as ApplicationRow[]
  const total = count || 0

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Applications</h2>
        <p className="mt-2 text-stone-600">Review incoming host submissions and publish approved stays.</p>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="grid grid-cols-[1.3fr_1fr_0.8fr_0.7fr] gap-4 border-b border-stone-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">
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
      <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} basePath="/admin/applications" />
    </div>
  )
}
