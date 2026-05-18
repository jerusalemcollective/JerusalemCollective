import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'

type ApplicationRow = {
  id: string
  host_name: string
  apartment_title: string
  area: string
  status: string
  verification_status: string
  created_at: string
}

export default async function AdminApplicationsPage() {
  const { supabase } = await requireAdminPermission('applications')
  const { data } = await supabase
    .from('host_applications')
    .select('id, host_name, apartment_title, area, status, verification_status, created_at')
    .order('created_at', { ascending: false })

  const applications = (data || []) as ApplicationRow[]

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
                  <StatusBadge status={application.status} />
                </div>
                <p className="text-sm text-stone-500">
                  {new Date(application.created_at).toLocaleDateString('en-GB')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === 'approved'
      ? 'bg-green-100 text-green-700'
      : status === 'rejected'
        ? 'bg-red-100 text-red-700'
        : status === 'in_review'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-stone-100 text-stone-700'

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${styles}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
