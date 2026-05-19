import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Breadcrumb } from '@/components/breadcrumb'
import { ReviewForm, type ReviewableBooking } from '@/components/review-form'

type CompletedBookingRow = {
  id: string
  listing_id: string
  check_in: string
  check_out: string
  listings: {
    title: string
  } | null
}

type ExistingReviewRow = {
  booking_id: string | null
}

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

  const completedBookings = (bookingRows || []) as CompletedBookingRow[]
  const bookingIds = completedBookings.map((booking) => booking.id)
  const { data: reviewRows } = bookingIds.length
    ? await supabase
        .from('reviews')
        .select('booking_id')
        .eq('reviewer_id', user.id)
        .in('booking_id', bookingIds)
    : { data: [] }

  const reviewedBookingIds = new Set(
    ((reviewRows || []) as ExistingReviewRow[])
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
