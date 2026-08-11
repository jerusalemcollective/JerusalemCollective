import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileClock,
  LifeBuoy,
  MessageCircle,
} from 'lucide-react'
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
  const windowEndDate = (() => {
    const end = new Date()
    end.setDate(end.getDate() + 30)
    return end.toISOString().slice(0, 10)
  })()

  const [
    { count: newEnquiryCount },
    { data: upcomingBookingsData },
    { data: supportCasesData },
    { count: totalListingsCount },
    { data: pendingApplicationData },
    { data: profileData },
  ] = await Promise.all([
    supabase
      .from('booking_requests')
      .select('*', { count: 'exact', head: true })
      .in('host_id', hostIds)
      .eq('status', 'new'),
    supabase
      .from('bookings')
      .select('id, check_in, check_out, listings(title)')
      .in('host_id', hostIds)
      .gte('check_in', today)
      .lte('check_in', windowEndDate)
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
    supabase.from('profiles').select('full_name').in('id', hostIds).limit(1).maybeSingle(),
  ])

  const newEnquiries = newEnquiryCount || 0
  const totalListings = totalListingsCount || 0
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

  const fullName = (profileData as { full_name?: string | null } | null)?.full_name || ''
  const firstName = fullName.trim().split(/\s+/)[0] || ''
  const hasActions = newEnquiries > 0 || openSupportCases.length > 0 || Boolean(pendingApplication)

  return (
    <div className="min-h-screen bg-[#F8F5F2] px-5 py-8 text-[#252525] md:px-6">
      <section className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Host dashboard</p>
            <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-stone-950">
              {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
            </h1>
            <p className="mt-1 text-stone-500">Here&apos;s what&apos;s happening with your stays.</p>
          </div>
          <Link
            href="/become-a-host"
            className="inline-flex w-fit shrink-0 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            {totalListings === 0 ? 'List your first stay' : 'Add another stay'}
          </Link>
        </header>

        <DraftListingCard />

        {/* Needs your attention */}
        <section className="mt-8">
          <h2 className="text-xl font-bold text-stone-950">Needs your attention</h2>
          <div className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-3xl bg-white shadow-sm">
            {hasActions ? (
              <>
                {newEnquiries > 0 && (
                  <AttentionRow
                    href="/host/dashboard/messages"
                    icon={<MessageCircle className="h-5 w-5" />}
                    title={
                      newEnquiries === 1
                        ? '1 guest is waiting for your reply'
                        : `${newEnquiries} guests are waiting for your reply`
                    }
                    detail="Open messages to reply, accept, or decline"
                  />
                )}
                {openSupportCases.length > 0 && (
                  <AttentionRow
                    href="/host/dashboard/cases"
                    icon={<LifeBuoy className="h-5 w-5" />}
                    title={`${openSupportCases.length} open support ${openSupportCases.length === 1 ? 'case' : 'cases'}`}
                    detail="Review the latest updates on your cases"
                  />
                )}
                {pendingApplication && (
                  <AttentionRow
                    href={`/host/dashboard/applications/${pendingApplication.id}`}
                    icon={<FileClock className="h-5 w-5" />}
                    title="Your application is under review"
                    detail="JLM Collective is reviewing this stay"
                  />
                )}
              </>
            ) : (
              <div className="flex items-center gap-3 px-6 py-8 text-stone-500">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span>You&apos;re all caught up — nothing needs your attention right now.</span>
              </div>
            )}
          </div>
        </section>

        {/* Upcoming stays */}
        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-stone-950">
              Upcoming stays <span className="text-sm font-medium text-stone-400">next 30 days</span>
            </h2>
            <Link
              href="/host/dashboard/calendar"
              className="text-sm font-bold text-[#c76f55] transition hover:text-[#a95b45]"
            >
              Open calendar
            </Link>
          </div>

          <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm">
            {upcomingBookings.length === 0 ? (
              <div className="px-6 py-12 text-center text-stone-500">
                No stays arriving in the next 30 days
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {upcomingBookings.map((booking) => (
                  <article key={booking.id} className="flex items-center gap-4 px-6 py-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#fff4ef] text-[#c76f55]">
                      <CalendarDays className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-stone-950">{booking.listings?.title || 'Stay'}</p>
                      <p className="mt-0.5 text-sm text-stone-500">Confirmed booking</p>
                    </div>
                    <p className="shrink-0 text-right text-sm font-semibold text-stone-700">
                      {formatDate(booking.check_in)} – {formatDate(booking.check_out)}
                      <span className="block text-xs font-medium text-stone-400">
                        {nightsBetween(booking.check_in, booking.check_out)}{' '}
                        {nightsBetween(booking.check_in, booking.check_out) === 1 ? 'night' : 'nights'}
                      </span>
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

function AttentionRow({
  href,
  title,
  detail,
  icon,
}: {
  href: string
  title: string
  detail: string
  icon: ReactNode
}) {
  return (
    <Link href={href} className="flex items-center gap-4 px-6 py-4 transition hover:bg-stone-50">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff4ef] text-[#c76f55]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-stone-950">{title}</span>
        <span className="block truncate text-sm text-stone-500">{detail}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-stone-300" />
    </Link>
  )
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

function nightsBetween(checkIn: string, checkOut: string) {
  const start = new Date(`${checkIn}T12:00:00`).getTime()
  const end = new Date(`${checkOut}T12:00:00`).getTime()
  return Math.max(1, Math.round((end - start) / 86_400_000))
}
