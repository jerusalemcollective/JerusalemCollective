import Link from 'next/link'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { HostDashboardNav } from '@/components/host-dashboard-nav'

type HostApplication = {
  id: string
  status: string
}

type HostListing = {
  id: string
  is_published: boolean
}

export default async function HostDashboardPage() {
  const { supabase, hostIds } = await requireHostDashboardAccess()
  const [{ data: applications }, { data: listings }, { count: newEnquiryCount }] = await Promise.all([
    supabase.from('host_applications').select('id, status').in('host_id', hostIds),
    supabase.from('listings').select('id, is_published').in('host_id', hostIds),
    supabase
      .from('booking_requests')
      .select('*', { count: 'exact', head: true })
      .in('host_id', hostIds)
      .eq('status', 'new'),
  ])

  const hostApplications = (applications || []) as HostApplication[]
  const hostListings = (listings || []) as HostListing[]
  const liveCount = hostListings.filter((listing) => listing.is_published).length
  const reviewCount = hostApplications.filter((application) =>
    ['new', 'in_review'].includes(application.status),
  ).length
  const needsActionCount = hostApplications.filter((application) =>
    ['changes_requested', 'rejected'].includes(application.status),
  ).length

  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-8 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">
        <HostDashboardNav />

        <header className="flex flex-col gap-4 border-b border-stone-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Host</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">Your hosting</h1>
            <p className="mt-2 text-stone-600">
              A quick view of what is live, what is waiting, and what needs you next.
            </p>
          </div>
          <Link
            href="/become-a-host"
            className="inline-flex w-fit rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            Add another stay
          </Link>
        </header>

        <div className="grid gap-4 border-b border-stone-200 py-5 sm:grid-cols-4">
          <Metric label="Live stays" value={liveCount} />
          <Metric label="New enquiries" value={newEnquiryCount || 0} />
          <Metric label="In review" value={reviewCount} />
          <Metric label="Needs attention" value={needsActionCount} />
        </div>

        <div className="grid gap-8 py-8 lg:grid-cols-[1.35fr_0.8fr]">
          <section>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-stone-950">Next steps</h2>
                <p className="mt-1 text-sm text-stone-600">
                  The few things most worth checking now.
                </p>
              </div>
            </div>

            <div className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
              <TaskRow
                href="/host/dashboard/listings"
                title={
                  needsActionCount > 0
                    ? `${needsActionCount} stay${needsActionCount === 1 ? '' : 's'} need changes`
                    : 'Listings are up to date'
                }
                detail={
                  needsActionCount > 0
                    ? 'Review the message from JLM Collective and resubmit when ready.'
                    : 'No listings currently need action from you.'
                }
                tone={needsActionCount > 0 ? 'attention' : 'calm'}
              />
              <TaskRow
                href="/host/dashboard/calendar"
                title="Keep availability current"
                detail="Block dates before guests enquire so your listings stay accurate."
                tone="calm"
              />
              <TaskRow
                href="/host/dashboard/messages"
                title={
                  newEnquiryCount
                    ? `${newEnquiryCount} new guest ${newEnquiryCount === 1 ? 'enquiry' : 'enquiries'}`
                    : 'Check guest messages'
                }
                detail={
                  newEnquiryCount
                    ? 'Reply, accept, or decline from your inbox.'
                    : 'Reply quickly when new enquiries begin coming in.'
                }
                tone={newEnquiryCount ? 'attention' : 'calm'}
              />
              <TaskRow
                href="/host/dashboard/payments"
                title="Complete payout setup"
                detail="Add payment details separately from your listings when you are ready."
                tone="calm"
              />
            </div>
          </section>

          <aside>
            <h2 className="text-xl font-bold text-stone-950">Workspace</h2>
            <div className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
              <WorkspaceLink href="/host/dashboard/listings" label="Listings" />
              <WorkspaceLink href="/host/dashboard/calendar" label="Calendar" />
              <WorkspaceLink href="/host/dashboard/messages" label="Messages" />
              <WorkspaceLink href="/host/dashboard/cases" label="Cases" />
              <WorkspaceLink href="/host/dashboard/payments" label="Payments" />
            </div>
          </aside>
        </div>
      </section>
    </main>
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

function TaskRow({
  href,
  title,
  detail,
  tone,
}: {
  href: string
  title: string
  detail: string
  tone: 'attention' | 'calm'
}) {
  return (
    <Link href={href} className="flex items-start justify-between gap-4 py-4 transition hover:bg-white/50">
      <div>
        <p className="font-semibold text-stone-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-stone-600">{detail}</p>
      </div>
      <span
        className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
          tone === 'attention'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-stone-200 text-stone-600'
        }`}
      >
        {tone === 'attention' ? 'Action' : 'Open'}
      </span>
    </Link>
  )
}

function WorkspaceLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between py-4 text-sm font-semibold text-stone-800 transition hover:text-[#c76f55]"
    >
      <span>{label}</span>
      <span aria-hidden="true">→</span>
    </Link>
  )
}
