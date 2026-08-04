'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  type BookingRequestSummary,
  type ConversationMessage,
  type ConversationSummary,
  loadConversationMessages,
  sendConversationMessage,
  updateBookingRequestStatus,
} from '@/lib/messaging'

const HOST_QUICK_REPLIES = [
  {
    label: 'Available - tell me more',
    text: 'Thank you for your enquiry. The property is available for your dates. Could you tell me a little more about your group and the purpose of your visit?',
  },
  {
    label: 'Confirm details',
    text: 'Thank you for getting in touch. I can confirm the property is available. Please let me know if you have any questions before we proceed.',
  },
  {
    label: 'Not available',
    text: 'Thank you for your enquiry. Unfortunately the property is not available for those dates. I would be happy to suggest alternative dates if that would help.',
  },
  {
    label: 'Need more info',
    text: 'Thank you for your message. Before I can confirm availability, could you let me know the purpose of your visit and a little about your group?',
  },
  {
    label: 'Will reply shortly',
    text: 'Thank you for your enquiry. I have received your message and will be in touch shortly to confirm availability.',
  },
  {
    label: 'Booking confirmed',
    text: 'I am pleased to confirm your booking. I will be in touch closer to your arrival date with check-in details and any information you need for your stay.',
  },
]

type MessagesInboxProps = {
  mode: 'guest' | 'host'
  initialConversationId?: string | null
  participantIds?: string[]
}

type CurrentUser = {
  id: string
}

type ListingPreview = {
  id: string
  title: string
  area: string
}

type ParticipantProfile = {
  id: string
  full_name: string | null
  avatar_url: string | null
}

type GuestProfile = {
  full_name: string | null
  avatar_url: string | null
  created_at: string | null
  about_me: string | null
  visiting_from: string | null
  visit_reason: string | null
  booking_count: number
}

type LatestMessagePreview = {
  conversation_id: string
  content: string
  sender_id: string
  created_at: string
}

type ConversationRealtimeRow = {
  id: string
  listing_id: string | null
  participant_1: string
  participant_2: string
  created_at: string
  updated_at: string
}

type LastMessagePreview = NonNullable<ConversationSummary['last_message']>

type RealtimeConversationMessage = Omit<ConversationMessage, 'read'> & {
  read: boolean | null
}

function isRequestOnlyConversationId(value: string | null) {
  return Boolean(value?.startsWith('request:'))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value)
}

function isRealtimeConversationMessage(value: unknown): value is RealtimeConversationMessage {
  if (!isRecord(value)) return false

  return (
    isString(value.id) &&
    isString(value.conversation_id) &&
    isString(value.sender_id) &&
    isString(value.content) &&
    (isBoolean(value.read) || value.read === null) &&
    isString(value.created_at)
  )
}

function isConversationRealtimeRow(value: unknown): value is ConversationRealtimeRow {
  if (!isRecord(value)) return false

  return (
    isString(value.id) &&
    isNullableString(value.listing_id) &&
    isString(value.participant_1) &&
    isString(value.participant_2) &&
    isString(value.created_at) &&
    isString(value.updated_at)
  )
}

function isLastMessagePreview(value: unknown): value is LastMessagePreview {
  if (!isRecord(value)) return false

  return isString(value.content) && isString(value.sender_id) && isString(value.created_at)
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatRequestDate(value: string | null) {
  if (!value) return 'Date not set'
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

function requestStatusLabel(status: string) {
  const labels: Record<string, string> = {
    new: 'New request',
    host_replied: 'Host replied',
    accepted: 'Accepted',
    declined: 'Declined',
    closed: 'Closed',
  }

  return labels[status] || status.replaceAll('_', ' ')
}

function requestStatusClass(status: string) {
  if (status === 'accepted') return 'bg-green-100 text-green-700 ring-green-200'
  if (status === 'declined' || status === 'closed') return 'bg-stone-100 text-stone-600 ring-stone-200'
  if (status === 'host_replied') return 'bg-amber-100 text-amber-700 ring-amber-200'
  return 'bg-[#fff4ef] text-[#c76f55] ring-[#f2d2c7]'
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('') || 'J'
}

export function MessagesInbox({ mode, initialConversationId = null, participantIds = [] }: MessagesInboxProps) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guestProfile, setGuestProfile] = useState<GuestProfile | null>(null)
  const [listingFilter, setListingFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const router = useRouter()
  const searchParams = useSearchParams()
  const participantIdsKey = participantIds.join('|')
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const threadScrollRef = useRef<HTMLDivElement | null>(null)

  // Keep the newest message in view, on send and on receive.
  useEffect(() => {
    const thread = threadScrollRef.current
    if (!thread) return
    thread.scrollTop = thread.scrollHeight
  }, [messages, selectedConversationId])

  // Open a conversation and you can start typing straight away, without
  // having to click into the box first.
  useEffect(() => {
    if (!selectedConversationId) return
    composerRef.current?.focus()
  }, [selectedConversationId])

  useEffect(() => {
    const loadInbox = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()

        if (!authUser) {
          router.push(`/login?redirect=${encodeURIComponent(mode === 'host' ? '/host/dashboard/messages' : '/account/messages')}`)
          return
        }

        setUser({ id: authUser.id })

        const hostParticipantIds = Array.from(
          new Set([authUser.id, ...participantIdsKey.split('|')].filter(Boolean)),
        )
        const participantColumn = mode === 'host' ? 'participant_2' : 'participant_1'
        const conversationQuery = supabase
          .from('conversations')
          .select('id, listing_id, participant_1, participant_2, created_at, updated_at')
          .order('updated_at', { ascending: false })
        const { data: conversationRows, error: conversationError } =
          mode === 'host'
            ? await conversationQuery.in(participantColumn, hostParticipantIds)
            : await conversationQuery.eq(participantColumn, authUser.id)

        if (conversationError) throw conversationError

        const conversationRowsList = (conversationRows || []) as ConversationSummary[]
        const hostRequestQuery =
          mode === 'host'
            ? supabase
                .from('booking_requests')
                .select('id, conversation_id, listing_id, host_id, guest_id, status, check_in, check_out, guests, message, created_at')
                .in('host_id', hostParticipantIds)
                .in('status', ['new', 'host_replied'])
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] })
        const { data: hostRequestRows } = await hostRequestQuery
        const hostRequests = (hostRequestRows || []) as BookingRequestSummary[]
        const conversationIdsFromRequests = hostRequests
          .map((request) => request.conversation_id)
          .filter(Boolean) as string[]
        const missingConversationIds = conversationIdsFromRequests.filter(
          (conversationId) => !conversationRowsList.some((conversation) => conversation.id === conversationId),
        )
        const { data: requestedConversationRows, error: requestedConversationError } =
          missingConversationIds.length > 0
            ? await supabase
                .from('conversations')
                .select('id, listing_id, participant_1, participant_2, created_at, updated_at')
                .in('id', missingConversationIds)
            : { data: [], error: null }

        if (requestedConversationError) throw requestedConversationError

        const rowsById = new Map<string, ConversationSummary>()
        for (const conversation of conversationRowsList) {
          rowsById.set(conversation.id, conversation)
        }
        for (const conversation of (requestedConversationRows || []) as ConversationSummary[]) {
          rowsById.set(conversation.id, conversation)
        }
        for (const request of hostRequests) {
          if (!request.conversation_id || rowsById.has(request.conversation_id)) continue

          rowsById.set(`request:${request.id}`, {
            id: `request:${request.id}`,
            listing_id: request.listing_id,
            participant_1: request.guest_id || '',
            participant_2: request.host_id || authUser.id,
            created_at: request.created_at,
            updated_at: request.created_at,
            last_message: request.message
              ? {
                  content: request.message,
                  sender_id: request.guest_id || '',
                  created_at: request.created_at,
                }
              : null,
            request,
          })
        }

        const rows = Array.from(rowsById.values()).sort(
          (first, second) => Date.parse(second.updated_at) - Date.parse(first.updated_at),
        )
        const listingIds = Array.from(
          new Set([
            ...rows.map((conversation) => conversation.listing_id).filter(Boolean),
            ...hostRequests.map((request) => request.listing_id).filter(Boolean),
          ]),
        ) as string[]
        const otherParticipantIds = rows.map((conversation) =>
          mode === 'host' ? conversation.participant_1 : conversation.participant_2,
        )

        const [{ data: listings }, { data: profiles }, { data: latestMessages }, { data: requests }] = await Promise.all([
          listingIds.length
            ? supabase
                .from('listings')
                .select('id, title, area')
                .in('id', listingIds)
            : Promise.resolve({ data: [] }),
          otherParticipantIds.length
            ? supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', otherParticipantIds)
            : Promise.resolve({ data: [] }),
          rows.some((conversation) => !isRequestOnlyConversationId(conversation.id))
            ? supabase
                .from('messages')
                .select('conversation_id, content, sender_id, created_at')
                .in('conversation_id', rows.map((conversation) => conversation.id).filter((id) => !isRequestOnlyConversationId(id)))
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] }),
          rows.some((conversation) => !isRequestOnlyConversationId(conversation.id))
            ? supabase
                .from('booking_requests')
                .select('id, conversation_id, listing_id, host_id, guest_id, status, check_in, check_out, guests, message, created_at')
                .in('conversation_id', rows.map((conversation) => conversation.id).filter((id) => !isRequestOnlyConversationId(id)))
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] }),
        ])

        const latestMessageRows: LatestMessagePreview[] = latestMessages || []
        const listingRows: ListingPreview[] = listings || []
        const profileRows: ParticipantProfile[] = profiles || []
        const requestRows: BookingRequestSummary[] =
          mode === 'host' ? [...(requests || []), ...hostRequests] : requests || []

        const latestByConversation = new Map<string, ConversationSummary['last_message']>()
        latestMessageRows.forEach((message) => {
          if (!latestByConversation.has(message.conversation_id)) {
            latestByConversation.set(message.conversation_id, message)
          }
        })

        const listingMap = new Map(listingRows.map((listing) => [listing.id, listing]))
        const profileMap = new Map(profileRows.map((profile) => [profile.id, profile]))

        // Legacy "message host" threads (created before conversations were
        // unified on COALESCE(hosts.user_id, hosts.id)) carry
        // participant_2 = hosts.id, which is not resolvable via profileMap.
        // Without this the guest sees the literal "Host". Resolve the display
        // name from the publicly-readable hosts table (by id or user_id).
        // Guest mode only; in host mode the other participant is always a guest.
        const unresolvedHostParticipantIds =
          mode === 'guest'
            ? Array.from(new Set(otherParticipantIds.filter((id) => id && !profileMap.has(id))))
            : []
        const hostParticipantMap = new Map<string, ParticipantProfile>()
        if (unresolvedHostParticipantIds.length > 0) {
          const idList = unresolvedHostParticipantIds.join(',')
          const { data: hostProfiles } = await supabase
            .from('hosts')
            .select('id, user_id, name, display_name, profile_photo_url')
            .or(`id.in.(${idList}),user_id.in.(${idList})`)
          for (const host of hostProfiles || []) {
            const entry: ParticipantProfile = {
              id: host.id,
              full_name: host.display_name || host.name || null,
              avatar_url: host.profile_photo_url || null,
            }
            if (host.id) hostParticipantMap.set(host.id, entry)
            if (host.user_id) hostParticipantMap.set(host.user_id, entry)
          }
        }

        const requestByConversation = new Map<string, BookingRequestSummary>()
        requestRows.forEach((request) => {
          if (request.conversation_id && !requestByConversation.has(request.conversation_id)) {
            requestByConversation.set(request.conversation_id, request)
          }
          requestByConversation.set(`request:${request.id}`, request)
        })

        const hydrated = rows.map((conversation) => ({
          ...conversation,
          listing: conversation.listing_id ? listingMap.get(conversation.listing_id) || null : null,
          other_participant:
            profileMap.get(mode === 'host' ? conversation.participant_1 : conversation.participant_2) || null,
          last_message: latestByConversation.get(conversation.id) || conversation.last_message || null,
          request: requestByConversation.get(conversation.id) || null,
        }))

        setConversations(hydrated)

        const requestedConversation = initialConversationId || searchParams.get('conversation')
        const nextConversationId =
          hydrated.find((conversation) => conversation.id === requestedConversation)?.id ||
          hydrated[0]?.id ||
          null

        setSelectedConversationId(nextConversationId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load messages.')
      } finally {
        setLoading(false)
      }
    }

    loadInbox()
  }, [initialConversationId, mode, participantIdsKey, router, searchParams])

  useEffect(() => {
    if (
      initialConversationId &&
      conversations.length > 0 &&
      !selectedConversationId
    ) {
      const match = conversations.find((conversation) => conversation.id === initialConversationId)
      if (match) {
        setSelectedConversationId(match.id)
      }
    }
  }, [initialConversationId, conversations, selectedConversationId])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }

    const supabase = createClient()

    let isActive = true
    const selectedRequestOnlyConversation = conversations.find(
      (conversation) => conversation.id === selectedConversationId && isRequestOnlyConversationId(conversation.id),
    )

    if (selectedRequestOnlyConversation?.request) {
      const request = selectedRequestOnlyConversation.request
      setMessages(
        request.message
          ? [
              {
                id: `request-message:${request.id}`,
                conversation_id: selectedRequestOnlyConversation.id,
                sender_id: request.guest_id || selectedRequestOnlyConversation.participant_1,
                content: request.message,
                read: true,
                created_at: request.created_at,
              },
            ]
          : [],
      )
      return () => {
        isActive = false
      }
    }

    const loadMessages = async () => {
      try {
        const selectedConv = conversations.find((conversation) => conversation.id === selectedConversationId) || null
        const otherParticipantId =
          selectedConv && user?.id
            ? selectedConv.participant_1 === user.id
              ? selectedConv.participant_2
              : selectedConv.participant_1
            : null
        const profilePromise =
          mode === 'host' && otherParticipantId
            ? Promise.all([
                supabase
                  .from('profiles')
                  .select('full_name, avatar_url, created_at, about_me, visiting_from, visit_reason')
                  .eq('id', otherParticipantId)
                  .maybeSingle(),
                supabase
                  .from('bookings')
                  .select('*', { count: 'exact', head: true })
                  .eq('user_id', otherParticipantId),
              ])
            : Promise.resolve(null)
        const [rows, guestContext] = await Promise.all([
          loadConversationMessages(supabase, selectedConversationId),
          profilePromise,
        ])
        const unreadIncomingMessageIds = rows
          .filter((message) => !message.read && message.sender_id !== user?.id)
          .map((message) => message.id)

        if (unreadIncomingMessageIds.length > 0) {
          const { error: readAtError } = await supabase
            .from('messages')
            .update({ read: true, read_at: new Date().toISOString() })
            .in('id', unreadIncomingMessageIds)

          if (readAtError) {
            await supabase
              .from('messages')
              .update({ read: true })
              .in('id', unreadIncomingMessageIds)
          }
        }

        if (isActive) {
          setMessages(
            rows.map((message) =>
              unreadIncomingMessageIds.includes(message.id)
                ? { ...message, read: true }
                : message,
            ),
          )
          if (unreadIncomingMessageIds.length > 0) {
            window.dispatchEvent(new Event('messages-read'))
          }
          if (mode === 'host' && guestContext) {
            const [{ data: profileData }, { count: bookingCount }] = guestContext
            setGuestProfile(
              profileData
                ? {
                    full_name: profileData.full_name ?? null,
                    avatar_url: profileData.avatar_url ?? null,
                    created_at: profileData.created_at ?? null,
                    about_me: profileData.about_me ?? null,
                    visiting_from: profileData.visiting_from ?? null,
                    visit_reason: profileData.visit_reason ?? null,
                    booking_count: bookingCount || 0,
                  }
                : null,
            )
          } else {
            setGuestProfile(null)
          }
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : 'Unable to load conversation.')
        }
      }
    }

    loadMessages()

    const refreshConversation = async (conversationId: string, updatedAt: string) => {
      const { data, error: latestMessageError } = await supabase
        .from('messages')
        .select('content, sender_id, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestMessageError) {
        if (isActive) {
          setError(latestMessageError.message)
        }
        return
      }

      const latestMessage = isLastMessagePreview(data) ? data : null

      if (!isActive) return

      setConversations((current) =>
        current
          .map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  updated_at: updatedAt,
                  last_message: latestMessage || conversation.last_message,
                }
              : conversation,
          )
          .sort((first, second) => Date.parse(second.updated_at) - Date.parse(first.updated_at)),
      )
    }

    const messagesChannel = supabase
      .channel(`messages-${selectedConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        (payload) => {
          if (!isRealtimeConversationMessage(payload.new)) return

          const nextMessage: ConversationMessage = {
            ...payload.new,
            read: payload.new.read ?? false,
          }

          setMessages((current) => {
            if (current.some((message) => message.id === nextMessage.id)) return current
            return [...current, nextMessage]
          })

          setConversations((current) =>
            current
              .map((conversation) =>
                conversation.id === nextMessage.conversation_id
                  ? {
                      ...conversation,
                      updated_at: nextMessage.created_at,
                      last_message: {
                        content: nextMessage.content,
                        sender_id: nextMessage.sender_id,
                        created_at: nextMessage.created_at,
                      },
                    }
                  : conversation,
              )
              .sort((first, second) => Date.parse(second.updated_at) - Date.parse(first.updated_at)),
          )
        },
      )
      .subscribe()

    const conversationsChannel = user?.id
      ? supabase
          .channel(`conversations-${user.id}-${selectedConversationId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'conversations',
              filter: `participant_1=eq.${user.id}`,
            },
            (payload) => {
              if (!isConversationRealtimeRow(payload.new)) return
              void refreshConversation(payload.new.id, payload.new.updated_at)
            },
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'conversations',
              filter: `participant_2=eq.${user.id}`,
            },
            (payload) => {
              if (!isConversationRealtimeRow(payload.new)) return
              void refreshConversation(payload.new.id, payload.new.updated_at)
            },
          )
          .subscribe()
      : null

    return () => {
      isActive = false
      void supabase.removeChannel(messagesChannel)
      if (conversationsChannel) {
        void supabase.removeChannel(conversationsChannel)
      }
    }
  }, [conversations, mode, selectedConversationId, user?.id])

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  )
  const selectedParticipantName =
    selectedConversation?.other_participant?.full_name || (mode === 'host' ? 'Guest' : 'Host')
  const selectedListingTitle = selectedConversation?.listing?.title || 'Conversation'
  const selectedListingArea = selectedConversation?.listing?.area || 'Jerusalem'
  const newRequestCount = conversations.filter((conversation) => conversation.request?.status === 'new').length
  const activeRequestCount = conversations.filter((conversation) =>
    conversation.request ? ['new', 'host_replied'].includes(conversation.request.status) : false,
  ).length

  const listingOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const conversation of conversations) {
      if (conversation.listing_id && conversation.listing) {
        seen.set(conversation.listing_id, conversation.listing.title)
      }
    }
    return Array.from(seen.entries())
  }, [conversations])

  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      const matchesListing = listingFilter === 'all' || conversation.listing_id === listingFilter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'new' && conversation.request?.status === 'new') ||
        (statusFilter === 'replied' && conversation.request?.status === 'host_replied') ||
        (statusFilter === 'accepted' && conversation.request?.status === 'accepted') ||
        (statusFilter === 'no_request' && !conversation.request)

      return matchesListing && matchesStatus
    })
  }, [conversations, listingFilter, statusFilter])

  const canAcceptSelectedConversation =
    mode === 'host' &&
    (selectedConversation?.request?.status === 'new' ||
      selectedConversation?.request?.status === 'host_replied')

  const handleSend = async () => {
    if (!user || !selectedConversationId || !draft.trim()) return
    if (isRequestOnlyConversationId(selectedConversationId)) {
      setError('This enquiry does not have a message thread yet.')
      return
    }

    // Empty the box straight away so replying feels instant. The text is put
    // back if the send fails, so nothing is ever lost.
    const text = draft.trim()
    setDraft('')
    if (composerRef.current) composerRef.current.style.height = 'auto'

    setSending(true)
    setError(null)
    const shouldUpdateRequestStatus =
      mode === 'host' &&
      Boolean(selectedConversation?.request?.id) &&
      selectedConversation?.request?.status === 'new'

    try {
      const supabase = createClient()
      await sendConversationMessage(supabase, selectedConversationId, user.id, text)
      if (mode === 'guest') {
        try {
          const notificationResponse = await fetch('/api/notify-host-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: selectedConversationId }),
          })
          const notificationResult = await notificationResponse.json().catch(() => null)
          if (!notificationResponse.ok || notificationResult?.emailSent === false) {
            console.error('Unable to send host message notification', notificationResult)
          }
        } catch (notificationError) {
          console.error('Unable to send host message notification', notificationError)
        }
      }
      if (mode === 'host') {
        try {
          const notificationResponse = await fetch('/api/notify-guest-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: selectedConversationId }),
          })
          const notificationResult = await notificationResponse.json().catch(() => null)
          if (!notificationResponse.ok || notificationResult?.emailSent === false) {
            console.error('Unable to send guest message notification', notificationResult)
          }
        } catch (notificationError) {
          console.error('Unable to send guest message notification', notificationError)
        }
      }
      if (shouldUpdateRequestStatus && selectedConversation?.request?.id) {
        await updateBookingRequestStatus(supabase, selectedConversation.request.id, 'host_replied')
      }
      const nextMessages = await loadConversationMessages(supabase, selectedConversationId)
      setMessages(nextMessages)
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversationId
            ? {
                ...conversation,
                updated_at: new Date().toISOString(),
                last_message: {
                  content: text,
                  sender_id: user.id,
                  created_at: new Date().toISOString(),
                },
              }
            : conversation,
        ),
      )
      if (shouldUpdateRequestStatus) {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === selectedConversationId
              ? {
                  ...conversation,
                  request: conversation.request
                    ? { ...conversation.request, status: 'host_replied' }
                    : conversation.request,
                }
              : conversation,
          ),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.')
      // Put the text back so a failed send never loses what was typed.
      setDraft((current) => current || text)
    } finally {
      setSending(false)
    }
  }

  const handleRequestStatus = async (status: 'accepted' | 'declined') => {
    if (!selectedConversation?.request?.id) return

    setSending(true)
    setError(null)

    try {
      const supabase = createClient()
      await updateBookingRequestStatus(supabase, selectedConversation.request.id, status)
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversationId
            ? {
                ...conversation,
                request: conversation.request ? { ...conversation.request, status } : conversation.request,
              }
            : conversation,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update request.')
    } finally {
      setSending(false)
    }
  }

  const handleAcceptEnquiry = async () => {
    if (!selectedConversation?.request?.id) return

    setIsAccepting(true)
    setError(null)

    try {
      const supabase = createClient()
      await updateBookingRequestStatus(supabase, selectedConversation.request.id, 'accepted')
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? {
                ...conversation,
                request: conversation.request
                  ? {
                      ...conversation.request,
                      status: 'accepted' as const,
                    }
                  : conversation.request,
              }
            : conversation,
        ),
      )
    } catch (err) {
      console.error('Failed to accept enquiry', err)
    } finally {
      setIsAccepting(false)
    }
  }

  if (loading) {
    return <MessagesInboxSkeleton />
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-bold text-stone-900">No conversations yet</h2>
        <p className="mt-2 text-stone-600">
          {mode === 'host'
            ? 'Guest enquiries will appear here once they start messaging you.'
            : 'When you message a host, your conversation will appear here.'}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
      <div className="grid h-[min(74vh,720px)] min-h-[560px] lg:grid-cols-[380px_1fr]">
        <aside className="border-b border-stone-200 bg-[#fbfaf8] lg:border-b-0 lg:border-r">
          <div className="border-b border-stone-200 bg-white px-5 py-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Inbox</p>
                <h2 className="mt-1 text-2xl font-bold text-stone-950">Messages</h2>
              </div>
              {mode === 'host' && newRequestCount > 0 && (
                <span className="rounded-full bg-[#c76f55] px-3 py-1 text-xs font-bold text-white">
                  {newRequestCount} new
                </span>
              )}
            </div>

            {mode === 'host' && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatusFilter('new')}
                  className="rounded-2xl bg-[#fff4ef] px-3 py-3 text-left transition hover:bg-[#fde8df]"
                >
                  <span className="block text-xl font-bold text-[#c76f55]">{newRequestCount}</span>
                  <span className="text-xs font-semibold text-stone-600">New requests</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="rounded-2xl bg-stone-100 px-3 py-3 text-left transition hover:bg-stone-200"
                >
                  <span className="block text-xl font-bold text-stone-950">{activeRequestCount}</span>
                  <span className="text-xs font-semibold text-stone-600">Active chats</span>
                </button>
              </div>
            )}
          </div>

          {mode === 'host' && (
            <div className="space-y-2 border-b border-stone-200 px-4 py-4">
              {listingOptions.length > 1 && (
                <select
                  value={listingFilter}
                  onChange={(event) => setListingFilter(event.target.value)}
                  className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 outline-none transition focus:border-[#c76f55]"
                >
                  <option value="all">All listings</option>
                  {listingOptions.map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 outline-none transition focus:border-[#c76f55]"
              >
                <option value="all">All messages</option>
                <option value="new">New enquiries</option>
                <option value="replied">Awaiting reply</option>
                <option value="accepted">Accepted</option>
              </select>
            </div>
          )}

          <div className="h-[calc(100%-9.5rem)] space-y-2 overflow-y-auto px-3 py-3">
            {filteredConversations.map((conversation) => {
              const participantName = conversation.other_participant?.full_name || (mode === 'host' ? 'Guest' : 'Host')
              const isSelected = conversation.id === selectedConversationId

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={`w-full rounded-3xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-[#c76f55] bg-white shadow-md shadow-stone-200/70'
                      : 'border-transparent bg-white/70 hover:border-stone-200 hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stone-950 text-sm font-bold text-white">
                      {getInitials(participantName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-stone-950">{participantName}</span>
                          <span className="mt-0.5 block truncate text-sm text-stone-500">
                            {conversation.listing?.title || 'Listing conversation'}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] font-medium text-stone-400">
                          {formatTimestamp(conversation.updated_at)}
                        </span>
                      </span>

                      {conversation.request && (
                        <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${requestStatusClass(conversation.request.status)}`}>
                          {requestStatusLabel(conversation.request.status)}
                        </span>
                      )}

                      <span className="mt-3 block line-clamp-2 text-sm leading-5 text-stone-600">
                        {conversation.last_message?.content || conversation.request?.message || 'Open conversation'}
                      </span>
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-[#fcfaf8]">
          <div className="border-b border-stone-200 bg-white px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F8F5F2] text-sm font-bold text-[#c76f55]">
                  {getInitials(selectedParticipantName)}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-stone-950">{selectedListingTitle}</h3>
                  <p className="truncate text-sm text-stone-500">
                    {selectedParticipantName} · {selectedListingArea}
                  </p>
                </div>
              </div>
              {selectedConversation?.request && (
                <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${requestStatusClass(selectedConversation.request.status)}`}>
                  {requestStatusLabel(selectedConversation.request.status)}
                </span>
              )}
            </div>

            {selectedConversation?.request && (
              <div className="mt-4 rounded-3xl border border-stone-200 bg-[#fbfaf8] p-4">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-center">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Dates</p>
                    <p className="mt-1 text-sm font-bold text-stone-950">
                      {formatRequestDate(selectedConversation.request.check_in)} to{' '}
                      {formatRequestDate(selectedConversation.request.check_out)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Guests</p>
                    <p className="mt-1 text-sm font-bold text-stone-950">
                      {selectedConversation.request.guests} guest{selectedConversation.request.guests === 1 ? '' : 's'}
                    </p>
                  </div>
                  {mode === 'host' && ['new', 'host_replied'].includes(selectedConversation.request.status) && (
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => handleRequestStatus('accepted')}
                        className="rounded-full bg-green-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-green-800 disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => handleRequestStatus('declined')}
                        className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {mode === 'host' && guestProfile && (
            <div className="border-b border-stone-200 bg-white/80 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  {guestProfile.avatar_url ? (
                    <img
                      src={guestProfile.avatar_url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stone-200 text-base font-bold text-stone-600">
                      {getInitials(guestProfile.full_name || 'Guest')}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-bold text-stone-950">{guestProfile.full_name || 'Guest'}</p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {guestProfile.booking_count === 0
                        ? 'First stay with JLM Collective'
                        : `${guestProfile.booking_count} previous stay${guestProfile.booking_count === 1 ? '' : 's'}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {guestProfile.visiting_from && (
                    <span className="rounded-full bg-[#F8F5F2] px-3 py-1 text-xs font-semibold text-stone-600">
                      From {guestProfile.visiting_from}
                    </span>
                  )}
                  {guestProfile.visit_reason && (
                    <span className="rounded-full bg-[#F8F5F2] px-3 py-1 text-xs font-semibold text-stone-600">
                      {guestProfile.visit_reason}
                    </span>
                  )}
                </div>
              </div>
              {guestProfile.about_me && (
                <p className="mt-3 rounded-2xl bg-[#F8F5F2] px-4 py-3 text-sm leading-6 text-stone-600">
                  {guestProfile.about_me}
                </p>
              )}
            </div>
          )}

          <div ref={threadScrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {messages.map((message) => {
              const isMine = message.sender_id === user?.id
              return (
                <div key={message.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                  {!isMine && (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[11px] font-bold text-stone-600">
                      {getInitials(selectedParticipantName)}
                    </span>
                  )}
                  <div
                    className={`max-w-[min(78%,34rem)] rounded-[1.35rem] px-4 py-3 text-sm shadow-sm ${
                      isMine
                        ? 'rounded-br-md bg-[#c76f55] text-white shadow-[#e6b09f]/40'
                        : 'rounded-bl-md bg-white text-stone-800 ring-1 ring-stone-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                    <p className={`mt-2 text-[11px] ${isMine ? 'text-white/75' : 'text-stone-400'}`}>
                      {formatTimestamp(message.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="border-t border-stone-200 bg-white p-4">
            {error && (
              <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}
            {canAcceptSelectedConversation && (
              <div className="mb-3 rounded-2xl bg-[#fff4ef] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-stone-900">Ready to confirm this booking?</p>
                  <button
                    type="button"
                    disabled={isAccepting}
                    onClick={handleAcceptEnquiry}
                    className="rounded-full bg-[#252525] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#111111] disabled:opacity-60"
                  >
                    {isAccepting ? 'Confirming...' : 'Accept booking'}
                  </button>
                </div>
              </div>
            )}
            {mode === 'host' && (
              <div className="mb-3">
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {HOST_QUICK_REPLIES.map((reply) => (
                    <button
                      key={reply.label}
                      type="button"
                      onClick={() => setDraft(reply.text)}
                      className="shrink-0 whitespace-nowrap rounded-full border border-stone-200 bg-[#fbfaf8] px-3.5 py-2 text-xs font-semibold text-stone-700 transition hover:border-[#c76f55] hover:bg-[#fff4ef] hover:text-[#c76f55]"
                    >
                      {reply.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-end gap-3 rounded-[1.5rem] border border-stone-200 bg-[#fbfaf8] p-2 focus-within:border-[#c76f55]">
              <textarea
                ref={composerRef}
                value={draft}
                rows={1}
                onChange={(event) => {
                  setDraft(event.target.value)
                  // Grow with the message instead of scrolling inside a fixed box.
                  const field = event.currentTarget
                  field.style.height = 'auto'
                  field.style.height = `${Math.min(field.scrollHeight, 144)}px`
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    if (draft.trim() && !sending) void handleSend()
                  }
                }}
                placeholder="Write a message..."
                className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-sm text-stone-900 outline-none placeholder:text-stone-500"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#252525] text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                {sending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13" />
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-2 px-2 text-[11px] text-stone-400">
              Enter to send · Shift + Enter for a new line
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

export function MessagesInboxSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="grid min-h-[420px] lg:grid-cols-[320px_1fr]">
        <aside className="border-b border-stone-200 lg:border-b-0 lg:border-r">
          <div className="space-y-4 p-5">
            {[0, 1, 2].map((item) => (
              <div key={item} className="animate-pulse rounded-2xl border border-stone-100 p-4">
                <div className="h-4 w-32 rounded bg-stone-200" />
                <div className="mt-3 h-3 w-44 rounded bg-stone-200" />
                <div className="mt-4 h-3 w-full rounded bg-stone-200" />
              </div>
            ))}
          </div>
        </aside>
        <section className="hidden p-6 lg:block">
          <div className="animate-pulse space-y-5">
            <div className="h-5 w-48 rounded bg-stone-200" />
            <div className="h-24 rounded-3xl bg-stone-200" />
            <div className="ml-auto h-14 w-64 rounded-2xl bg-stone-200" />
            <div className="h-14 w-72 rounded-2xl bg-stone-200" />
          </div>
        </section>
      </div>
    </div>
  )
}
