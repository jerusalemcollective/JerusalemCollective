import Link from 'next/link'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { HostDashboardNav } from '@/components/host-dashboard-nav'

type UpcomingBooking = {
  id: string
  check_in: string
  check_out: string
  listings: {
    title: string
  } | null
}

type HostSupportCase = {
  id: string
  reason: string
  status: string
}

type PendingApplication = {
  id: string
  status: string
}

export default async function HostDashboardPage() {
  const { supabase, hostIds } = await requireHostDashboardAccess()
  const today = new Date().toISOString().slice(0, 10)

  const [
    { count: newEnquiryCount },
    { count: awaitingResponseCount },
    { data: upcomingBookingsData },
    { data: supportCasesData },
    { count: activeListingsCount },
    { count: totalListingsCount },
    { count: totalApplicationsCount },
    { data: pendingApplicationData },
  ] = await Promise.all([
    supabase
      .from('booking_requests')
      .select('*', { count: 'exact', head: true })
      .in('host_id', hostIds)
      .eq('status', 'new'),
    supabase
      .from('booking_requests')
      .select('*', { count: 'exact', head: true })
      .in('host_id', hostIds)
      .in('status', ['new', 'host_replied']),
    supabase
      .from('bookings')
      .select('id, check_in, check_out, listings(title)')
      .in('host_id', hostIds)
      .gte('check_in', today)
      .order('check_in', { ascending: true })
      .limit(5),
    supabase
      .from('support_cases')
      .select('id, reason, status')
      .in('host_id', hostIds)
      .not('status', 'in', '(resolved,closed)')
      .order('created_at', { ascending: false }),
    supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .in('host_id', hostIds)
      .eq('is_published', true),
    supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .in('host_id', hostIds),
    supabase
      .from('host_applications')
      .select('*', { count: 'exact', head: true })
      .in('host_id', hostIds),
    supabase
      .from('host_applications')
      .select('id, status')
      .in('host_id', hostIds)
      .not('status', 'in', '(approved,rejected)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const newEnquiries = newEnquiryCount || 0
  const awaitingResponses = awaitingResponseCount || 0
  const activeListings = activeListingsCount || 0
  const totalListings = totalListingsCount || 0
  const totalApplications = totalApplicationsCount || 0
  const upcomingBookings = (upcomingBookingsData || []) as UpcomingBooking[]
  const openSupportCases = (supportCasesData || []) as HostSupportCase[]
  const pendingApplication = pendingApplicationData as PendingApplication | null
  const isNewHost = totalListings === 0 && totalApplications === 0
  const hasActions =
    newEnquiries > 0 ||
    awaitingResponses > 0 ||
    openSupportCases.length > 0 ||
    Boolean(pendingApplication)

  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-8 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">
        <HostDashboardNav />

        <header className="flex flex-col gap-4 border-b border-stone-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Host dashboard</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">Overview</h1>
            <p className="mt-2 max-w-2xl text-stone-600">
              The main things that need attention, your next stays, and the tools you use most.
            </p>
          </div>
          <Link
            href="/become-a-host"
            className="inline-flex w-fit rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            Add another stay
          </Link>
        </header>

        <section className="border-b border-stone-200 py-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-stone-950">Action queue</h2>
              <p className="mt-1 text-sm text-stone-600">Start here when you open your dashboard.</p>
            </div>
            <p className="text-sm font-semibold text-stone-500">
              {activeListings} active {activeListings === 1 ? 'listing' : 'listings'}
            </p>
          </div>

          {isNewHost ? (
            <div className="mt-4 rounded-3xl bg-white p-6 shadow-sm">
              <p className="text-lg font-bold text-stone-950">Welcome to your host dashboard</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                You don't have a listing yet. Submit your first stay and we'll review it within a few days.
              </p>
              <Link
                href="/become-a-host"
                className="mt-5 inline-flex rounded-full bg-[#c76f55] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#b85f47]"
              >
                Submit a stay
              </Link>
            </div>
          ) : hasActions ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {newEnquiries > 0 ? (
                <ActionCard
                  href="/host/dashboard/messages"
                  title={`${newEnquiries} new ${newEnquiries === 1 ? 'enquiry' : 'enquiries'}`}
                  detail="Review the latest guest messages and respond while the enquiry is fresh."
                  tone="amber"
                />
              ) : null}
              {awaitingResponses > 0 ? (
                <ActionCard
                  href="/host/dashboard/messages"
                  title={`${awaitingResponses} awaiting your reply`}
                  detail="Keep conversations moving by replying, accepting, or declining from your inbox."
                  tone="amber"
                />
              ) : null}
              {openSupportCases.length > 0 ? (
                <ActionCard
                  href="/host/dashboard/cases"
                  title={`${openSupportCases.length} open support ${openSupportCases.length === 1 ? 'case' : 'cases'}`}
                  detail="Check any open case updates connected to your stays."
                  tone="rose"
                />
              ) : null}
              {pendingApplication ? (
                <ActionCard
                  href={`/host/dashboard/applications/${pendingApplication.id}`}
                  title="Your application is under review"
                  detail="JLM Collective is reviewing this stay. You can open it to see the current status."
                  tone="stone"
                />
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-3xl border-l-4 border-green-500 bg-white p-6 shadow-sm">
              <p className="text-lg font-bold text-stone-950">All caught up</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                No urgent enquiries, cases, or applications need your attention right now.
              </p>
            </div>
          )}
        </section>

        <div className="grid gap-8 py-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-stone-950">Upcoming stays</h2>
                <p className="mt-1 text-sm text-stone-600">The next confirmed stays on your calendar.</p>
              </div>
              <Link
                href="/host/dashboard/messages"
                className="text-sm font-bold text-[#c76f55] transition hover:text-[#a95b45]"
              >
                View all trips
              </Link>
            </div>

            <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm">
              {upcomingBookings.length === 0 ? (
                <div className="px-6 py-12 text-center text-stone-500">No upcoming bookings yet</div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {upcomingBookings.map((booking) => (
                    <article
                      key={booking.id}
                      className="grid gap-3 px-6 py-5 md:grid-cols-[1fr_auto] md:items-center"
                    >
                      <div>
                        <p className="font-bold text-stone-950">{booking.listings?.title || 'Stay'}</p>
                        <p className="mt-1 text-sm text-stone-500">Confirmed booking</p>
                      </div>
                      <p className="text-sm font-semibold text-stone-700">
                        {formatDate(booking.check_in)} - {formatDate(booking.check_out)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside>
            <h2 className="text-xl font-bold text-stone-950">Quick links</h2>
            <p className="mt-1 text-sm text-stone-600">Jump straight into the work.</p>

            <div className="mt-4 grid gap-3">
              <QuickLinkCard
                href="/host/dashboard/listings"
                title="Listings"
                detail="Manage live and submitted stays."
              />
              <QuickLinkCard
                href="/host/dashboard/calendar"
                title="Calendar"
                detail="Block dates and keep availability accurate."
              />
              <QuickLinkCard
                href="/host/dashboard/messages"
                title="Messages"
                detail="Reply to guests and manage enquiries."
              />
              <QuickLinkCard
                href="/host/dashboard/payments"
                title="Payments"
                detail="Set your payout and direct payment preferences."
              />
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

function ActionCard({
  href,
  title,
  detail,
  tone,
}: {
  href: string
  title: string
  detail: string
  tone: 'amber' | 'rose' | 'stone'
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-400'
      : tone === 'rose'
        ? 'border-rose-400'
        : 'border-stone-400'

  return (
    <Link
      href={href}
      className={`block rounded-3xl border-l-4 ${toneClass} bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      <p className="text-lg font-bold text-stone-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-stone-600">{detail}</p>
    </Link>
  )
}

function QuickLinkCard({
  href,
  title,
  detail,
}: {
  href: string
  title: string
  detail: string
}) {
  return (
    <Link
      href={href}
      className="block rounded-3xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-bold text-stone-950">{title}</p>
          <p className="mt-1 text-sm leading-6 text-stone-600">{detail}</p>
        </div>
        <span className="text-sm font-bold text-[#c76f55]" aria-hidden="true">
          -&gt;
        </span>
      </div>
    </Link>
  )
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
