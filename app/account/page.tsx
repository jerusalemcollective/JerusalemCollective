import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, Building2, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { WelcomeBanner } from '@/components/welcome-banner'
import { formatDateDisplay } from '@/lib/utils/date'

type ListingJoin = { id: string; title: string; area: string | null }

type UnreadThread = {
  id: string
  name: string
  listingTitle: string | null
  snippet: string
  created_at: string
}

// Relative time for message previews ("2h ago", "Yesterday", or a date).
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return formatDateDisplay(iso)
}

export default async function GuestDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/account')
  }

  const today = new Date().toISOString().slice(0, 10)

  const [{ data: profile }, { data: nextTrip }, { count: bookingCount }, { data: convRows }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase
      .from('bookings')
      .select('id, check_in, check_out, listings(id, title, area)')
      .eq('user_id', user.id)
      .gte('check_in', today)
      .not('status', 'in', '(cancelled,completed)')
      .order('check_in', { ascending: true })
      .limit(1)
      .maybeSingle<{
        id: string
        check_in: string | null
        check_out: string | null
        // Supabase may hydrate a to-one join as an object OR a single-element array.
        listings: ListingJoin | ListingJoin[] | null
      }>(),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    // The guest is always participant_1 of their conversations (see
    // getOrCreateConversation in lib/messaging).
    supabase
      .from('conversations')
      .select('id, listing_id, participant_2, updated_at')
      .eq('participant_1', user.id),
  ])

  const firstName = (profile?.full_name || '').trim().split(/\s+/)[0] || 'there'
  const isNewGuest = (bookingCount || 0) === 0

  // Build the unread-messages preview by mirroring the guest inbox's resolution
  // (latest message per thread, participant_2 → profiles with a legacy hosts
  // fallback, listing title). Only unread threads, newest first, capped at 3.
  const conversationIds = (convRows || []).map((c) => c.id)
  let unreadThreads: UnreadThread[] = []
  let unreadCount = 0

  if (conversationIds.length > 0) {
    const [{ data: latestMessages }, { data: unreadRows }] = await Promise.all([
      supabase
        .from('messages')
        .select('conversation_id, content, sender_id, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', conversationIds)
        .eq('read', false)
        .neq('sender_id', user.id),
    ])

    const unreadConversationIds = new Set((unreadRows || []).map((m) => m.conversation_id))
    unreadCount = unreadConversationIds.size

    const latestByConversation = new Map<string, { content: string; created_at: string }>()
    for (const message of latestMessages || []) {
      if (!latestByConversation.has(message.conversation_id)) {
        latestByConversation.set(message.conversation_id, message)
      }
    }

    const topConversations = (convRows || [])
      .filter((c) => unreadConversationIds.has(c.id))
      .sort((a, b) => {
        const at = latestByConversation.get(a.id)?.created_at || a.updated_at
        const bt = latestByConversation.get(b.id)?.created_at || b.updated_at
        return Date.parse(bt) - Date.parse(at)
      })
      .slice(0, 3)

    const listingIds = Array.from(new Set(topConversations.map((c) => c.listing_id).filter(Boolean))) as string[]
    const otherParticipantIds = topConversations.map((c) => c.participant_2)

    const [{ data: listings }, { data: profiles }] = await Promise.all([
      listingIds.length
        ? supabase.from('listings').select('id, title').in('id', listingIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      otherParticipantIds.length
        ? supabase.from('profiles').select('id, full_name').in('id', otherParticipantIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    ])

    const listingMap = new Map((listings || []).map((l) => [l.id, l.title]))
    const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]))

    // Legacy "message host" threads carry participant_2 = hosts.id, which is not
    // in profiles; resolve those names from the publicly-readable hosts table.
    const unresolved = Array.from(new Set(otherParticipantIds.filter((id) => id && !profileMap.has(id))))
    if (unresolved.length > 0) {
      const idList = unresolved.join(',')
      const { data: hostProfiles } = await supabase
        .from('hosts')
        .select('id, user_id, name, display_name')
        .or(`id.in.(${idList}),user_id.in.(${idList})`)
      for (const h of (hostProfiles || []) as { id: string; user_id: string | null; name: string | null; display_name: string | null }[]) {
        const name = h.display_name || h.name || null
        if (h.id) profileMap.set(h.id, name)
        if (h.user_id) profileMap.set(h.user_id, name)
      }
    }

    unreadThreads = topConversations.map((c) => {
      const last = latestByConversation.get(c.id)
      return {
        id: c.id,
        name: profileMap.get(c.participant_2) || 'Host',
        listingTitle: c.listing_id ? listingMap.get(c.listing_id) || null : null,
        snippet: last?.content || '',
        created_at: last?.created_at || c.updated_at,
      }
    })
  }

  const nextListing = Array.isArray(nextTrip?.listings)
    ? nextTrip?.listings[0] ?? null
    : nextTrip?.listings ?? null

  const nights =
    nextTrip?.check_in && nextTrip?.check_out
      ? Math.round((new Date(nextTrip.check_out).getTime() - new Date(nextTrip.check_in).getTime()) / (1000 * 60 * 60 * 24))
      : null

  return (
    <div className="space-y-5">
      {isNewGuest && <WelcomeBanner />}

      <div>
        <h2 className="text-xl font-bold text-stone-900">Welcome back, {firstName}</h2>
        <p className="mt-0.5 text-sm text-stone-500">Here&rsquo;s what&rsquo;s happening with your trips.</p>
      </div>

      {/* Next trip */}
      {nextTrip ? (
        <div className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-[#fff4ef]">
            <Building2 className="h-7 w-7 text-[#c76f55]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#c76f55]">Your next trip</p>
            <p className="mt-0.5 truncate font-bold text-stone-900">{nextListing?.title || 'Stay'}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-600">
              <CalendarDays className="h-4 w-4" />
              {formatDateDisplay(nextTrip.check_in)} – {formatDateDisplay(nextTrip.check_out)}
              {nights ? ` · ${nights} ${nights === 1 ? 'night' : 'nights'}` : ''}
            </p>
          </div>
          <Link
            href="/account/bookings"
            className="flex-shrink-0 rounded-lg bg-[#c76f55] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b25f47]"
          >
            View booking
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
            <CalendarDays className="h-6 w-6 text-stone-400" />
          </div>
          <p className="font-semibold text-stone-900">No upcoming trips</p>
          <p className="mt-1 text-sm text-stone-600">When you book a stay, it will show up here.</p>
          <Link
            href="/stays"
            className="mt-4 inline-flex rounded-lg bg-[#252525] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#111111]"
          >
            Browse stays
          </Link>
        </div>
      )}

      {/* Unread messages */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h3 className="flex items-center gap-2 font-semibold text-stone-900">
            Unread messages
            {unreadCount > 0 && (
              <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#c76f55] px-1.5 text-[11px] font-bold leading-none text-white">
                {unreadCount}
              </span>
            )}
          </h3>
          <Link href="/account/messages" className="text-sm font-semibold text-[#c76f55] hover:underline">
            View all
          </Link>
        </div>

        {unreadThreads.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
              <Mail className="h-6 w-6 text-stone-400" />
            </div>
            <p className="text-sm text-stone-600">You&rsquo;re all caught up.</p>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {unreadThreads.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`/account/messages?conversation=${thread.id}`}
                  className="flex items-start gap-3 px-4 py-3 transition hover:bg-stone-50"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#fff4ef] text-xs font-semibold text-[#c76f55]">
                    {thread.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-stone-900">
                        {thread.name}
                        {thread.listingTitle ? <span className="font-normal text-stone-500"> · {thread.listingTitle}</span> : ''}
                      </p>
                      <span className="flex-shrink-0 text-xs text-stone-400">{relativeTime(thread.created_at)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-stone-600">{thread.snippet}</p>
                  </div>
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#c76f55]" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
