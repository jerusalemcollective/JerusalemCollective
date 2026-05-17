import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdmin()
  const [
    { count: applicationCount },
    { count: newApplicationCount },
    { count: publishedListingCount },
    { count: draftListingCount },
    { count: hostCount },
    { data: recentApplications },
  ] = await Promise.all([
    supabase.from('host_applications').select('*', { count: 'exact', head: true }),
    supabase.from('host_applications').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('is_published', false),
    supabase.from('hosts').select('*', { count: 'exact', head: true }),
    supabase
      .from('host_applications')
      .select('id, host_name, apartment_title, area, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Overview</h2>
        <p className="mt-2 text-stone-600">
          Monitor submissions, listings, and host activity from one place.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Applications" value={applicationCount || 0} />
        <SummaryCard label="New submissions" value={newApplicationCount || 0} />
        <SummaryCard label="Published listings" value={publishedListingCount || 0} />
        <SummaryCard label="Hosts" value={hostCount || 0} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/applications"
          className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-sm font-semibold text-stone-500">Review</p>
          <h3 className="mt-2 text-xl font-bold text-stone-950">Applications</h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Approve, reject, and publish incoming host submissions.
          </p>
        </Link>
        <Link
          href="/admin/listings"
          className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-sm font-semibold text-stone-500">Manage</p>
          <h3 className="mt-2 text-xl font-bold text-stone-950">Listings</h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Publish, hide, and feature live inventory.
          </p>
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h3 className="text-lg font-bold text-stone-950">Recent applications</h3>
          <Link href="/admin/applications" className="text-sm font-semibold text-[#c76f55] hover:underline">
            View all
          </Link>
        </div>
        <div className="divide-y divide-stone-100">
          {(recentApplications || []).map((application) => (
            <Link
              key={application.id}
              href={`/admin/applications/${application.id}`}
              className="grid gap-2 px-6 py-4 transition hover:bg-stone-50 md:grid-cols-[1.2fr_1fr_0.7fr]"
            >
              <div>
                <p className="font-bold text-stone-950">{application.apartment_title}</p>
                <p className="mt-1 text-sm text-stone-500">{application.host_name}</p>
              </div>
              <p className="text-sm text-stone-700">{application.area}</p>
              <StatusBadge status={application.status} />
            </Link>
          ))}
          {!recentApplications?.length && (
            <div className="px-6 py-10 text-center text-stone-500">No applications yet.</div>
          )}
        </div>
      </div>

      <div className="mt-4 text-sm text-stone-500">
        Draft listings: {draftListingCount || 0}
      </div>
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
    <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${styles}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

