'use client'

import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

export type ReviewableBooking = {
  id: string
  listing_id: string
  listings: {
    title: string
  } | null
  check_in: string
  check_out: string
}

type ReviewFormProps = {
  bookings: ReviewableBooking[]
  initialBookingId?: string | null
  initialRating?: string | null
}

const getReviewErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes('duplicate') || message.includes('already exists') || message.includes('already')) {
      return 'You have already submitted a review for this stay.'
    }
  }
  return 'We could not save your review. Please try again.'
}

export function ReviewForm({
  bookings,
  initialBookingId = null,
  initialRating = null,
}: ReviewFormProps) {
  const initialBooking = bookings.some((booking) => booking.id === initialBookingId)
    ? initialBookingId || ''
    : bookings[0]?.id || ''
  const parsedRating = Number(initialRating || 0)
  const initialStarRating =
    Number.isInteger(parsedRating) && parsedRating >= 1 && parsedRating <= 5
      ? parsedRating
      : 0
  const [selectedBookingId, setSelectedBookingId] = useState(initialBooking)
  const [rating, setRating] = useState(initialStarRating)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedBookingId) || null,
    [bookings, selectedBookingId],
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedBooking) {
      setError('Please choose a stay to review.')
      return
    }

    if (rating < 1) {
      setError('Please choose a star rating.')
      return
    }

    setSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Please sign in again before submitting your review.')
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()

      const reviewerName = profile?.full_name || user.email?.split('@')[0] || 'Guest'
      const { error: insertError } = await supabase.from('reviews').insert({
        listing_id: selectedBooking.listing_id,
        booking_id: selectedBooking.id,
        reviewer_id: user.id,
        reviewer_name: reviewerName,
        rating,
        title: title.trim() || null,
        content: content.trim() || null,
        is_approved: false,
      })

      if (insertError) throw insertError

      setSubmitted(true)
      setMessage('Thank you - your review will appear once approved')
    } catch (submitError) {
      setError(getReviewErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  if (bookings.length === 0 || submitted) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-sm">
        <h2 className="mb-2 text-xl font-bold text-stone-900">
          {submitted ? 'Thank you' : 'No reviews waiting'}
        </h2>
        <p className="text-stone-600">
          {message || 'After a completed stay, you will be able to review it here.'}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg bg-white p-6 shadow-sm">
      <div className="space-y-5">
        <label className="block">
          <span className="text-sm font-semibold text-stone-800">Stay</span>
          <select
            value={selectedBookingId}
            onChange={(event) => setSelectedBookingId(event.target.value)}
            className={inputClass}
          >
            {bookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {booking.listings?.title || 'Stay'} - {formatDate(booking.check_in)} to {formatDate(booking.check_out)}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="text-sm font-semibold text-stone-800">Rating</p>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
                aria-label={`${star} star${star === 1 ? '' : 's'}`}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill={star <= (hoveredRating || rating) ? '#c76f55' : '#e7e5e4'}
                  className="transition-colors duration-100"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-stone-800">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            className={inputClass}
            placeholder="Optional short title"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-stone-800">Review</span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={500}
            rows={6}
            className={`${inputClass} resize-y`}
            placeholder="Share what future guests should know."
          />
          <span className="mt-2 block text-right text-xs text-stone-400">{content.length}/500</span>
        </label>

        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-[#c76f55] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#b85f47] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : 'Submit review'}
        </button>
      </div>
    </form>
  )
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]'
