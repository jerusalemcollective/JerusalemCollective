import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdminPermission('overview')
  const [
    { count: applicationCount },
    { count: newApplicationCount },
    { count: publishedListingCount },
    { count: draftListingCount },
    { count: hostCount },
    { count: newEnquiryCount },
    { data: recentApplications },
    { data: recentEnquiries },
  ] = await Promise.all([
    supabase.from('host_applications').select('*', { count: 'exact', head: true }),
    supabase.from('host_applications').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('is_published', false),
    supabase.from('hosts').select('*', { count: 'exact', head: true }),
    supabase.from('booking_requests').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase
      .from('host_applications')
      .select('id, host_name, apartment_title, area, status, created_at')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('booking_requests')
      .select('id, listing_id, guest_id, status, check_in, check_out, guests, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])
  const recentListingIds = (recentEnquiries || []).map((request: any) => request.listing_id).filter(Boolean)
  const recentGuestIds = (recentEnquiries || []).map((request: any) => request.guest_id).filter(Boolean)
  const [{ data: enquiryListings }, { data: enquiryGuests }] = await Promise.all([
    recentListingIds.length
      ? supabase.from('listings').select('id, title, area').in('id', recentListingIds)
      : Promise.resolve({ data: [] }),
    recentGuestIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', recentGuestIds)
      : Promise.resolve({ data: [] }),
  ])
  const enquiryListingMap = new Map((enquiryListings || []).map((listing: any) => [listing.id, listing]))
  const enquiryGuestMap = new Map((enquiryGuests || []).map((guest: any) => [guest.id, guest]))

  return (
    <div>
      <header className="border-b border-stone-200 pb-6">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Overview</h2>
        <p className="mt-2 text-stone-600">
          A quick read on what needs review and what is already live.
        </p>
      </header>

      <div className="grid gap-4 border-b border-stone-200 py-5 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Applications" value={applicationCount || 0} />
        <Metric label="New submissions" value={newApplicationCount || 0} />
        <Metric label="New enquiries" value={newEnquiryCount || 0} />
        <Metric label="Published" value={publishedListingCount || 0} />
        <Metric label="Hidden drafts" value={draftListingCount || 0} />
        <Metric label="Hosts" value={hostCount || 0} />
      </div>

      <div className="grid gap-8 py-8 xl:grid-cols-[1.35fr_0.75fr]">
        <section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-stone-950">Recent applications</h3>
              <p className="mt-1 text-sm text-stone-600">
                The newest host submissions, ready to review in order.
              </p>
            </div>
            <Link href="/admin/applications" className="text-sm font-semibold text-[#c76f55] hover:underline">
              View all
            </Link>
          </div>

          <div className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
            {(recentApplications || []).map((application) => (
              <Link
                key={application.id}
                href={`/admin/applications/${application.id}`}
                className="grid gap-3 py-4 transition hover:bg-white/50 md:grid-cols-[1.25fr_0.8fr_auto] md:items-center"
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
              <div className="py-8 text-sm text-stone-500">No applications yet.</div>
            )}
          </div>
        </section>

        <aside>
          <h3 className="text-xl font-bold text-stone-950">Work queue</h3>
          <div className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
            <QueueLink
              href="/admin/enquiries"
              title="New enquiries"
              detail={`${newEnquiryCount || 0} guests waiting`}
            />
            <QueueLink
              href="/admin/applications"
              title="Review applications"
              detail={`${newApplicationCount || 0} new waiting`}
            />
            <QueueLink
              href="/admin/listings"
              title="Manage listings"
              detail={`${draftListingCount || 0} hidden or not yet live`}
            />
            <QueueLink
              href="/admin/cases"
              title="Handle disputes"
              detail="Refunds and support cases"
            />
            <QueueLink
              href="/admin/analytics"
              title="Check analytics"
              detail="Searches, saves, and enquiries"
            />
          </div>

          <h3 className="mt-8 text-xl font-bold text-stone-950">Recent enquiries</h3>
          <div className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
            {(recentEnquiries || []).map((request: any) => (
              <Link key={request.id} href="/admin/enquiries" className="block py-4 transition hover:text-[#c76f55]">
                <p className="font-semibold text-stone-950">
                  {enquiryListingMap.get(request.listing_id)?.title || 'Stay enquiry'}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {enquiryGuestMap.get(request.guest_id)?.full_name || 'Guest'} | {request.guests || 1} guest{request.guests === 1 ? '' : 's'}
                </p>
              </Link>
            ))}
            {!recentEnquiries?.length && (
              <div className="py-6 text-sm text-stone-500">No enquiries yet.</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-stone-950">{value}</p>
    </div>
  )
}

function QueueLink({
  href,
  title,
  detail,
}: {
  href: string
  title: string
  detail: string
}) {
  return (
    <Link href={href} className="block py-4 transition hover:text-[#c76f55]">
      <p className="font-semibold text-stone-950">{title}</p>
      <p className="mt-1 text-sm text-stone-600">{detail}</p>
    </Link>
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
          : 'bg-stone-200 text-stone-700'

  return (
    <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${styles}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
