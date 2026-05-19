'use client'

import { useEffect, useMemo, useState } from 'react'
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

type MessagesInboxProps = {
  mode: 'guest' | 'host'
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

export function MessagesInbox({ mode }: MessagesInboxProps) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

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

        const participantColumn = mode === 'host' ? 'participant_2' : 'participant_1'
        const { data: conversationRows, error: conversationError } = await supabase
          .from('conversations')
          .select('id, listing_id, participant_1, participant_2, created_at, updated_at')
          .eq(participantColumn, authUser.id)
          .order('updated_at', { ascending: false })

        if (conversationError) throw conversationError

        const rows = (conversationRows || []) as ConversationSummary[]
        const listingIds = rows.map((conversation) => conversation.listing_id).filter(Boolean) as string[]
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
          rows.length
            ? supabase
                .from('messages')
                .select('conversation_id, content, sender_id, created_at')
                .in('conversation_id', rows.map((conversation) => conversation.id))
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] }),
          rows.length
            ? supabase
                .from('booking_requests')
                .select('id, conversation_id, listing_id, status, check_in, check_out, guests, message, created_at')
                .in('conversation_id', rows.map((conversation) => conversation.id))
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] }),
        ])

        const latestMessageRows: LatestMessagePreview[] = latestMessages || []
        const listingRows: ListingPreview[] = listings || []
        const profileRows: ParticipantProfile[] = profiles || []
        const requestRows: BookingRequestSummary[] = requests || []

        const latestByConversation = new Map<string, ConversationSummary['last_message']>()
        latestMessageRows.forEach((message) => {
          if (!latestByConversation.has(message.conversation_id)) {
            latestByConversation.set(message.conversation_id, message)
          }
        })

        const listingMap = new Map(listingRows.map((listing) => [listing.id, listing]))
        const profileMap = new Map(profileRows.map((profile) => [profile.id, profile]))
        const requestByConversation = new Map<string, BookingRequestSummary>()
        requestRows.forEach((request) => {
          if (request.conversation_id && !requestByConversation.has(request.conversation_id)) {
            requestByConversation.set(request.conversation_id, request)
          }
        })

        const hydrated = rows.map((conversation) => ({
          ...conversation,
          listing: conversation.listing_id ? listingMap.get(conversation.listing_id) || null : null,
          other_participant:
            profileMap.get(mode === 'host' ? conversation.participant_1 : conversation.participant_2) || null,
          last_message: latestByConversation.get(conversation.id) || null,
          request: requestByConversation.get(conversation.id) || null,
        }))

        setConversations(hydrated)

        const requestedConversation = searchParams.get('conversation')
        const initialConversationId =
          hydrated.find((conversation) => conversation.id === requestedConversation)?.id ||
          hydrated[0]?.id ||
          null

        setSelectedConversationId(initialConversationId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load messages.')
      } finally {
        setLoading(false)
      }
    }

    loadInbox()
  }, [mode, router, searchParams])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }

    const supabase = createClient()

    let isActive = true

    const loadMessages = async () => {
      try {
        const rows = await loadConversationMessages(supabase, selectedConversationId)
        if (isActive) {
          setMessages(rows)
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
  }, [selectedConversationId, user?.id])

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  )

  const handleSend = async () => {
    if (!user || !selectedConversationId || !draft.trim()) return

    setSending(true)
    setError(null)
    const shouldUpdateRequestStatus =
      mode === 'host' &&
      Boolean(selectedConversation?.request?.id) &&
      selectedConversation?.request?.status === 'new'

    try {
      const supabase = createClient()
      await sendConversationMessage(supabase, selectedConversationId, user.id, draft.trim())
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
                  content: draft.trim(),
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
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.')
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
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="grid min-h-[620px] lg:grid-cols-[320px_1fr]">
        <aside className="border-b border-stone-200 lg:border-b-0 lg:border-r">
          <div className="border-b border-stone-100 px-5 py-4">
            <h2 className="text-lg font-bold text-stone-900">Messages</h2>
          </div>
          <div className="divide-y divide-stone-100">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedConversationId(conversation.id)}
                className={`w-full px-5 py-4 text-left transition ${
                  conversation.id === selectedConversationId ? 'bg-[#fff4ef]' : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-stone-900">
                      {conversation.other_participant?.full_name || (mode === 'host' ? 'Guest' : 'Host')}
                    </p>
                    <p className="mt-0.5 text-sm text-stone-500">
                      {conversation.listing?.title || 'Listing conversation'}
                    </p>
                    {conversation.request && (
                      <span className="mt-2 inline-flex rounded-full bg-[#fff4ef] px-2.5 py-1 text-[11px] font-bold text-[#c76f55]">
                        {requestStatusLabel(conversation.request.status)}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-stone-400">
                    {formatTimestamp(conversation.updated_at)}
                  </span>
                </div>
                {conversation.last_message && (
                  <p className="mt-3 line-clamp-2 text-sm text-stone-600">
                    {conversation.last_message.content}
                  </p>
                )}
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[620px] flex-col">
          <div className="border-b border-stone-100 px-5 py-4">
            <h3 className="font-bold text-stone-900">
              {selectedConversation?.listing?.title || 'Conversation'}
            </h3>
            <p className="text-sm text-stone-500">
              {selectedConversation?.listing?.area || 'Jerusalem'}
            </p>
            {selectedConversation?.request && (
              <div className="mt-3 rounded-2xl bg-[#F8F5F2] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-700">
                    {requestStatusLabel(selectedConversation.request.status)}
                  </span>
                  <span className="text-sm font-medium text-stone-700">
                    {formatRequestDate(selectedConversation.request.check_in)} to{' '}
                    {formatRequestDate(selectedConversation.request.check_out)}
                  </span>
                  <span className="text-sm text-stone-500">
                    {selectedConversation.request.guests} guest{selectedConversation.request.guests === 1 ? '' : 's'}
                  </span>
                </div>
                {mode === 'host' && ['new', 'host_replied'].includes(selectedConversation.request.status) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => handleRequestStatus('accepted')}
                      className="rounded-full bg-green-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-green-800 disabled:opacity-50"
                    >
                      Accept request
                    </button>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => handleRequestStatus('declined')}
                      className="rounded-full border border-red-200 px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-[#fcfaf8] px-5 py-5">
            {messages.map((message) => {
              const isMine = message.sender_id === user?.id
              return (
                <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      isMine ? 'bg-[#c76f55] text-white' : 'bg-white text-stone-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                    <p className={`mt-1 text-[11px] ${isMine ? 'text-white/75' : 'text-stone-400'}`}>
                      {formatTimestamp(message.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="border-t border-stone-100 p-4">
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a message..."
                className="min-h-12 flex-1 resize-none rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                className="h-12 rounded-2xl bg-[#252525] px-5 text-sm font-bold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
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
