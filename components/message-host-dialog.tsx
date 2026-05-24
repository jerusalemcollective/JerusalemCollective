'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  createListingEnquiry,
  getOrCreateConversation,
  sendConversationMessage,
} from '@/lib/messaging'
import { recordListingEngagement } from '@/lib/listing-engagement'
import { formatDateDisplay, formatDateISO } from '@/lib/utils/date'

type MessageHostDialogProps = {
  listingId: string
  listingTitle: string
  hostId: string | null | undefined
  dateRange?: {
    from?: Date
    to?: Date
  }
  guests?: number
  intent?: 'message' | 'request'
  buttonLabel?: string
  buttonClassName?: string
  disabled?: boolean
  disabledReason?: string
  showIcon?: boolean
  quickQuestion?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onConversationCreated?: (conversationId: string) => void
}

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes('network') || message.includes('fetch')) {
      return 'Could not connect - please check your internet connection and try again.'
    }
    if (message.includes('duplicate') || message.includes('already')) {
      return 'You have already sent an enquiry for this property. Check your messages.'
    }
    return error.message
  }
  return 'We could not send your enquiry. Please try again or contact us on WhatsApp.'
}

export function MessageHostDialog({
  listingId,
  listingTitle,
  hostId,
  dateRange,
  guests = 1,
  intent = 'message',
  buttonLabel,
  buttonClassName,
  disabled = false,
  disabledReason,
  showIcon = true,
  quickQuestion = false,
  open: controlledOpen,
  onOpenChange,
  onConversationCreated,
}: MessageHostDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [message, setMessage] = useState(
    intent === 'request' && !quickQuestion
      ? 'Hi, I would like to request this stay for my dates. Please let me know if it is available.'
      : '',
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [senderName, setSenderName] = useState('')
  const router = useRouter()
  const isRequest = intent === 'request'
  const dialogOpen = controlledOpen ?? internalOpen
  const checkIn = dateRange?.from ? formatDateISO(dateRange.from) : null
  const checkOut = dateRange?.to ? formatDateISO(dateRange.to) : null
  const checkInDisplay = dateRange?.from ? formatDateDisplay(dateRange.from) : null
  const checkOutDisplay = dateRange?.to ? formatDateDisplay(dateRange.to) : null
  const dialogTitle = quickQuestion
    ? 'Ask a quick question'
    : isRequest
      ? 'Request to book'
      : 'Message host'
  const eyebrow = quickQuestion
    ? 'Quick question'
    : isRequest
      ? 'Booking request'
      : 'Message host'
  const successTitle = isRequest && !quickQuestion ? 'Request sent' : 'Message sent'
  const successDescription =
    isRequest && !quickQuestion
      ? 'Your booking request has been sent to the host. No payment is due unless the host confirms.'
      : 'Your message has been sent to the host. You will receive an email when they reply.'

  const setDialogOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  useEffect(() => {
    if (!dialogOpen) return

    let isActive = true

    const loadSenderName = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      if (isActive && profile?.full_name) {
        setSenderName(profile.full_name)
      }
    }

    void loadSenderName()

    return () => {
      isActive = false
    }
  }, [dialogOpen])

  if (!hostId) {
    return controlledOpen === undefined ? (
      <button
        type="button"
        disabled
        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 py-3 text-sm font-semibold text-stone-400"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Messaging unavailable
      </button>
    ) : null
  }

  const handleSend = async () => {
    if (!message.trim()) return

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push(`/login?redirect=${encodeURIComponent(`/listings/${listingId}`)}`)
        return
      }

      if (isRequest && !quickQuestion && (!checkIn || !checkOut)) {
        setError('Please choose check-in and check-out dates first.')
        return
      }

      let requestId: string | null = null
      let createdConversationId: string | null = null

      if (isRequest && !quickQuestion) {
        const enquiry = await createListingEnquiry(
          supabase,
          listingId,
          checkIn,
          checkOut,
          guests,
          message.trim(),
        )
        requestId = enquiry.requestId
        createdConversationId = enquiry.conversationId
        await recordListingEngagement(supabase, listingId, 'booking_request')
      } else {
        createdConversationId = await getOrCreateConversation(
          supabase,
          user.id,
          hostId,
          listingId,
        )
        await sendConversationMessage(
          supabase,
          createdConversationId,
          user.id,
          message.trim(),
        )
        await recordListingEngagement(supabase, listingId, 'enquiry')
      }

      if (requestId) {
        await fetch('/api/notify-host-enquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId }),
        }).catch((notificationError) => {
          console.error('Unable to send host enquiry notification', notificationError)
        })
      }

      const { data: convData } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const nextConversationId = convData?.id || createdConversationId || null
      setConversationId(nextConversationId)
      if (nextConversationId) {
        onConversationCreated?.(nextConversationId)
      }
      setSubmitted(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setSubmitted(false)
    setConversationId(null)
    setMessage(
      intent === 'request' && !quickQuestion
        ? 'Hi, I would like to request this stay for my dates. Please let me know if it is available.'
        : '',
    )
    setError(null)
  }

  return (
    <>
      {controlledOpen === undefined && (
        <button
          type="button"
          disabled={disabled}
          title={disabledReason}
          onClick={() => {
            if (!disabled) setDialogOpen(true)
          }}
          className={
            buttonClassName ||
            'flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50'
          }
        >
          {showIcon && (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )}
          {buttonLabel || 'Message host'}
        </button>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <button
            type="button"
            aria-label="Close message dialog"
            onClick={closeDialog}
            className="absolute inset-0"
          />

          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            {submitted ? (
              <div className="flex flex-col items-center gap-6 px-2 py-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 ring-8 ring-green-50/50">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-stone-950">{successTitle}</h3>
                  <p className="mx-auto max-w-xs text-sm leading-6 text-stone-600">
                    {successDescription}
                  </p>
                </div>

                <div className="w-full space-y-3 rounded-2xl bg-[#F8F5F2] p-4 text-left">
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
                    What happens next
                  </p>
                  <div className="space-y-2">
                    {[
                      {
                        step: '1',
                        text:
                          isRequest && !quickQuestion
                            ? 'The host reviews your dates and confirms whether the stay is available.'
                            : 'The host reviews your message and replies — usually within a few hours.',
                      },
                      {
                        step: '2',
                        text:
                          isRequest && !quickQuestion
                            ? 'You can message back and forth to confirm any details.'
                            : 'You can message back and forth to confirm details.',
                      },
                      {
                        step: '3',
                        text:
                          isRequest && !quickQuestion
                            ? 'Once the host accepts, your dates are blocked on the calendar.'
                            : 'Once you are both happy, the host can confirm the booking.',
                      },
                    ].map(({ step, text }) => (
                      <div key={step} className="flex items-start gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#c76f55] text-[10px] font-bold text-white">
                          {step}
                        </span>
                        <p className="text-sm leading-5 text-stone-600">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-full space-y-2">
                  {conversationId ? (
                    <Link
                      href={`/account/messages?conversation=${conversationId}`}
                      onClick={closeDialog}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#c76f55] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#b85f47]"
                    >
                      Open conversation
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ) : (
                    <Link
                      href="/account/messages"
                      onClick={closeDialog}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#c76f55] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#b85f47]"
                    >
                      View your messages
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="w-full rounded-full border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-950"
                  >
                    Back to listing
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                      {eyebrow}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-stone-950">
                      {dialogTitle}
                    </h2>
                    {isRequest && !quickQuestion && (
                      <p className="mt-2 text-sm text-stone-600">
                        {checkInDisplay && checkOutDisplay
                          ? `${checkInDisplay} to ${checkOutDisplay} | ${guests} guest${guests === 1 ? '' : 's'}`
                          : 'Choose your dates before sending the request.'}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                    aria-label="Close"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <label className="mt-6 block text-sm font-semibold text-stone-700">
                  Your name
                  <input
                    type="text"
                    value={senderName}
                    onChange={(event) => setSenderName(event.target.value)}
                    placeholder="Your name"
                    className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="text-sm font-semibold text-stone-800">
                    {quickQuestion ? 'Your question' : 'Your message'}
                  </span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={
                      quickQuestion
                        ? 'e.g. Is there a Shabbat lift? Is the kitchen kosher?'
                        : isRequest
                        ? 'Add anything the host should know about your stay...'
                        : 'Hi, is this stay available for my dates?'
                    }
                    className="mt-2 min-h-36 w-full resize-none rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
                  />
                </label>

                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="rounded-full border border-stone-200 px-5 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!message.trim() || loading}
                    className="rounded-full bg-[#c76f55] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#b55f47] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading
                      ? 'Sending...'
                      : quickQuestion
                        ? 'Send question'
                        : isRequest
                          ? 'Send request'
                          : 'Send message'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
