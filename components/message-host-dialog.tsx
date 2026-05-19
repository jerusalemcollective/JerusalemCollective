'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { createListingEnquiry } from '@/lib/messaging'
import { recordListingEngagement } from '@/lib/listing-engagement'

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
}: MessageHostDialogProps) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState(
    intent === 'request'
      ? 'Hi, I would like to request this stay for my dates. Please let me know if it is available.'
      : '',
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const isRequest = intent === 'request'
  const checkIn = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null
  const checkOut = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null

  if (!hostId) {
    return (
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
    )
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

      if (isRequest && (!checkIn || !checkOut)) {
        setError('Please choose check-in and check-out dates first.')
        return
      }

      const { conversationId } = await createListingEnquiry(
        supabase,
        listingId,
        checkIn,
        checkOut,
        guests,
        message.trim(),
      )
      await recordListingEngagement(supabase, listingId, isRequest ? 'booking_request' : 'enquiry')
      router.push(`/account/messages?conversation=${conversationId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send your message.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          buttonClassName ||
          'flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50'
        }
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {buttonLabel || (isRequest ? 'Request to book' : 'Message host')}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <button
            type="button"
            aria-label="Close message dialog"
            onClick={() => setOpen(false)}
            className="absolute inset-0"
          />

          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                  {isRequest ? 'Request to book' : 'Message host'}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-stone-950">{listingTitle}</h2>
                {isRequest && (
                  <p className="mt-2 text-sm text-stone-600">
                    {checkIn && checkOut
                      ? `${checkIn} to ${checkOut} | ${guests} guest${guests === 1 ? '' : 's'}`
                      : 'Choose your dates before sending the request.'}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <label className="mt-6 block">
              <span className="text-sm font-semibold text-stone-800">Your message</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={
                  isRequest
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
                onClick={() => setOpen(false)}
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
                {loading ? 'Sending...' : isRequest ? 'Send request' : 'Send message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
