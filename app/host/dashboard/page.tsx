import Link from 'next/link'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { DraftListingCard } from '@/components/draft-listing-card'
import { oneOrNull } from '@/lib/utils/one-or-null'

type UpcomingBooking = {
  id: string
  check_in: string
  check_out: string
  listings: {
    title: string
  } | null
}

type UpcomingBookingRow = Omit<UpcomingBooking, 'listings'> & {
  listings?: UpcomingBooking['listings'] | NonNullable<UpcomingBooking['listings']>[] | null
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
        .neq('status', 'resolved')
        .neq('status', 'closed')
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
        .neq('status', 'approved')
        .neq('status', 'rejected')
        .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const newEnquiries = newEnquiryCount || 0
  const awaitingResponses = awaitingResponseCount || 0
  const activeListings = activeListingsCount || 0
  const totalListings = totalListingsCount || 0
  const totalApplications = totalApplicationsCount || 0
  const upcomingBookings: UpcomingBooking[] = (upcomingBookingsData || []).map((booking: UpcomingBookingRow) => ({
    id: booking.id,
    check_in: booking.check_in,
    check_out: booking.check_out,
    listings: oneOrNull(booking.listings),
  }))
  const openSupportCases: HostSupportCase[] = (supportCasesData || []).map((supportCase: HostSupportCase) => ({
    id: supportCase.id,
    reason: supportCase.reason,
    status: supportCase.status,
  }))
  const pendingApplication: PendingApplication | null = pendingApplicationData
    ? {
        id: pendingApplicationData.id,
        status: pendingApplicationData.status,
      }
    : null
  const isNewHost = totalListings === 0 && totalApplications === 0
  const hasActions = awaitingResponses > 0 || openSupportCases.length > 0 || Boolean(pendingApplication)

  return (
    <div className="min-h-screen bg-[#F8F5F2] px-5 py-8 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">

        <header className="flex flex-col gap-4 border-b border-stone-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Host dashboard</p>
            <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-stone-950">Overview</h1>
          </div>
          <Link
            href="/become-a-host"
            className="inline-flex w-fit rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            {totalListings === 0 ? 'List your first stay' : 'Add another stay'}
          </Link>
        </header>

        <DraftListingCard />

        {newEnquiries > 0 && (
          <section className="border-b border-stone-200 py-6">
            <Link
              href="/host/dashboard/messages"
              className="block rounded-3xl bg-[#252525] p-6 text-white shadow-sm transition hover:bg-[#111111]"
            >
              <p className="text-5xl font-bold">{newEnquiries}</p>
              <p className="mt-2 text-lg font-semibold">
                {newEnquiries === 1
                  ? 'guest is waiting for your reply'
                  : 'guests are waiting for your reply'}
              </p>
              <p className="mt-1 text-sm text-white/80">Tap to open messages →</p>
            </Link>
          </section>
        )}

        {hasActions && (
          <section className="border-b border-stone-200 py-6">
            <div className="grid gap-4 md:grid-cols-2">
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
          </section>
        )}

        <section className="py-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-stone-950">Upcoming stays</h2>
            <Link
              href="/host/dashboard/calendar"
              className="text-sm font-bold text-[#c76f55] transition hover:text-[#a95b45]"
            >
              Open calendar
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
      </section>
    </div>
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

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
