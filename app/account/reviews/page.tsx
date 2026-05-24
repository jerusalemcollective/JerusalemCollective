import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { Breadcrumb } from '@/components/breadcrumb'
import { ReviewForm, type ReviewableBooking } from '@/components/review-form'

const completedBookingSchema = z.object({
  id: z.string(),
  listing_id: z.string(),
  check_in: z.string(),
  check_out: z.string(),
  listings: z
    .object({
      title: z.string(),
    })
    .nullable(),
})

const existingReviewSchema = z.object({
  booking_id: z.string().nullable(),
})

export const metadata = {
  title: 'My reviews',
  robots: { index: false, follow: false },
}

export default async function ReviewsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/account/reviews')
  }

  const today = new Date().toISOString().slice(0, 10)
  const { data: bookingRows } = await supabase
    .from('bookings')
    .select('id, listing_id, check_in, check_out, listings(title)')
    .eq('user_id', user.id)
    .lt('check_out', today)
    .order('check_out', { ascending: false })

  const completedBookings = z.array(completedBookingSchema).parse(bookingRows ?? [])
  const bookingIds = completedBookings.map((booking) => booking.id)
  const { data: reviewRows } = bookingIds.length
    ? await supabase
        .from('reviews')
        .select('booking_id')
        .eq('reviewer_id', user.id)
        .in('booking_id', bookingIds)
    : { data: [] }

  const reviewedBookingIds = new Set(
    z.array(existingReviewSchema).parse(reviewRows ?? [])
      .map((review) => review.booking_id)
      .filter((bookingId): bookingId is string => Boolean(bookingId)),
  )
  const reviewableBookings: ReviewableBooking[] = completedBookings.filter(
    (booking) => !reviewedBookingIds.has(booking.id),
  )

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-6">
        <Breadcrumb items={[{ label: 'Account', href: '/account' }, { label: 'Reviews' }]} />

        <header className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-stone-950">Reviews</h1>
          <p className="mt-2 text-stone-600">Share feedback after a completed stay.</p>
        </header>

        <ReviewForm bookings={reviewableBookings} />
      </div>
    </div>
  )
}
