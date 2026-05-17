'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  type ConversationMessage,
  type ConversationSummary,
  loadConversationMessages,
  sendConversationMessage,
} from '@/lib/messaging'

type MessagesInboxProps = {
  mode: 'guest' | 'host'
}

type CurrentUser = {
  id: string
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
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
          .select('*')
          .eq(participantColumn, authUser.id)
          .order('updated_at', { ascending: false })

        if (conversationError) throw conversationError

        const rows = (conversationRows || []) as ConversationSummary[]
        const listingIds = rows.map((conversation) => conversation.listing_id).filter(Boolean) as string[]
        const otherParticipantIds = rows.map((conversation) =>
          mode === 'host' ? conversation.participant_1 : conversation.participant_2,
        )

        const [{ data: listings }, { data: profiles }, { data: latestMessages }] = await Promise.all([
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
        ])

        const latestByConversation = new Map<string, ConversationSummary['last_message']>()
        ;(latestMessages || []).forEach((message: any) => {
          if (!latestByConversation.has(message.conversation_id)) {
            latestByConversation.set(message.conversation_id, message)
          }
        })

        const listingMap = new Map((listings || []).map((listing: any) => [listing.id, listing]))
        const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]))

        const hydrated = rows.map((conversation) => ({
          ...conversation,
          listing: conversation.listing_id ? listingMap.get(conversation.listing_id) || null : null,
          other_participant:
            profileMap.get(mode === 'host' ? conversation.participant_1 : conversation.participant_2) || null,
          last_message: latestByConversation.get(conversation.id) || null,
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

    const loadMessages = async () => {
      try {
        const supabase = createClient()
        const rows = await loadConversationMessages(supabase, selectedConversationId)
        setMessages(rows)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load conversation.')
      }
    }

    loadMessages()
  }, [selectedConversationId])

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  )

  const handleSend = async () => {
    if (!user || !selectedConversationId || !draft.trim()) return

    setSending(true)
    setError(null)

    try {
      const supabase = createClient()
      await sendConversationMessage(supabase, selectedConversationId, user.id, draft.trim())
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
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div className="rounded-3xl bg-white p-8 text-stone-600 shadow-sm">Loading messages...</div>
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

