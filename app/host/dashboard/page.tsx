import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
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

type UnreadThread = {
  conversationId: string
  listingId: string | null
  guestId: string | null
  preview: string
  createdAt: string
}

export default async function HostDashboardPage() {
  const { supabase, hostIds } = await requireHostDashboardAccess()
  const hostIdSet = new Set(hostIds)
  const today = new Date().toISOString().slice(0, 10)

  const [
    { data: upcomingBookingsData },
    { data: profileData },
    { data: conversationRows },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, check_in, check_out, listings(title)')
      .in('host_id', hostIds)
      .gte('check_in', today)
      .order('check_in', { ascending: true })
      .limit(2),
    supabase.from('profiles').select('full_name').in('id', hostIds).limit(1).maybeSingle(),
    supabase
      .from('conversations')
      .select('id, listing_id, participant_1, updated_at')
      .in('participant_2', hostIds),
  ])

  const upcomingBookings: UpcomingBooking[] = (upcomingBookingsData || []).map((booking: UpcomingBookingRow) => ({
    id: booking.id,
    check_in: booking.check_in,
    check_out: booking.check_out,
    listings: oneOrNull(booking.listings),
  }))

  const fullName = (profileData as { full_name?: string | null } | null)?.full_name || ''
  const firstName = fullName.trim().split(/\s+/)[0] || ''

  // Build the unread-message list: one row per conversation that has an unread
  // message from the guest (anything not sent by this host). Ordered by most
  // recent unread first, so the newest threads surface at the top.
  const conversations = (conversationRows || []) as {
    id: string
    listing_id: string | null
    participant_1: string
    updated_at: string
  }[]
  const conversationById = new Map(conversations.map((conversation) => [conversation.id, conversation]))

  let unreadThreads: UnreadThread[] = []
  if (conversations.length > 0) {
    const { data: unreadMessages } = await supabase
      .from('messages')
      .select('conversation_id, content, created_at, sender_id')
      .in(
        'conversation_id',
        conversations.map((conversation) => conversation.id),
      )
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(100)

    const seen = new Set<string>()
    for (const message of (unreadMessages || []) as {
      conversation_id: string
      content: string
      created_at: string
      sender_id: string
    }[]) {
      if (hostIdSet.has(message.sender_id)) continue // the host's own reply
      if (seen.has(message.conversation_id)) continue // keep only the latest per thread
      const conversation = conversationById.get(message.conversation_id)
      if (!conversation) continue
      seen.add(message.conversation_id)
      unreadThreads.push({
        conversationId: message.conversation_id,
        listingId: conversation.listing_id,
        guestId: conversation.participant_1,
        preview: message.content,
        createdAt: message.created_at,
      })
    }
  }

  const totalUnread = unreadThreads.length
  const shownUnread = unreadThreads.slice(0, 3)

  // Resolve guest names + listing titles only for the rows we actually show.
  const listingIds = Array.from(new Set(shownUnread.map((thread) => thread.listingId).filter(Boolean))) as string[]
  const guestIds = Array.from(new Set(shownUnread.map((thread) => thread.guestId).filter(Boolean))) as string[]

  let listingTitleById = new Map<string, string>()
  let guestNameById = new Map<string, string | null>()
  if (listingIds.length > 0) {
    const { data } = await supabase.from('listings').select('id, title').in('id', listingIds)
    listingTitleById = new Map(((data as { id: string; title: string }[]) || []).map((row) => [row.id, row.title]))
  }
  if (guestIds.length > 0) {
    const { data } = await supabase.from('profiles').select('id, full_name').in('id', guestIds)
    guestNameById = new Map(
      ((data as { id: string; full_name: string | null }[]) || []).map((row) => [row.id, row.full_name]),
    )
  }

  const unreadRows = shownUnread.map((thread) => {
    const name = (thread.guestId && guestNameById.get(thread.guestId)) || 'Guest'
    const listing = (thread.listingId && listingTitleById.get(thread.listingId)) || 'Stay'
    return {
      key: thread.conversationId,
      name,
      initials: toInitials(name),
      listing,
      preview: thread.preview,
      time: relativeTime(thread.createdAt),
    }
  })

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
        </header>

        <DraftListingCard />

        {/* Next stays */}
        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-stone-950">Upcoming stays</h2>
            <Link
              href="/host/dashboard/calendar"
              className="text-sm font-bold text-[#c76f55] transition hover:text-[#a95b45]"
            >
              Open calendar
            </Link>
          </div>

          {upcomingBookings.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No upcoming stays &mdash; nothing booked yet.</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {upcomingBookings.map((booking, index) => {
                const nights = nightsBetween(booking.check_in, booking.check_out)
                return (
                  <article
                    key={booking.id}
                    className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-100"
                  >
                    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#fff4ef] text-[#c76f55]">
                      <CalendarDays className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      {index === 0 && (
                        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Next stay</p>
                      )}
                      <p className="mt-1 truncate font-bold text-stone-950">{booking.listings?.title || 'Stay'}</p>
                      <p className="mt-0.5 text-sm text-stone-500">
                        {formatDate(booking.check_in)} – {formatDate(booking.check_out)} · {nights}{' '}
                        {nights === 1 ? 'night' : 'nights'}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {/* Unread messages */}
        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-stone-950">Unread messages</h2>
            {totalUnread > 3 && (
              <Link
                href="/host/dashboard/messages"
                className="text-sm font-bold text-[#c76f55] transition hover:text-[#a95b45]"
              >
                See all
              </Link>
            )}
          </div>

          {unreadRows.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">You&rsquo;re all caught up &mdash; no new messages.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="divide-y divide-stone-100">
                {unreadRows.map((row) => (
                  <Link
                    key={row.key}
                    href="/host/dashboard/messages"
                    className="flex items-start gap-4 px-6 py-4 transition hover:bg-stone-50"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff4ef] text-sm font-bold text-[#c76f55]">
                      {row.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-stone-950">
                        {row.name} <span className="font-normal text-stone-400">· {row.listing}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-stone-500">{row.preview}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 pt-0.5">
                      <span className="text-xs text-stone-400">{row.time}</span>
                      <span className="h-2 w-2 rounded-full bg-[#c76f55]" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </section>
    </div>
  )
}

function toInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  const initials = `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase()
  return initials || '?'
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

function relativeTime(iso: string) {
  const then = new Date(iso).getTime()
  const diffMs = Math.max(0, Date.now() - then)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
