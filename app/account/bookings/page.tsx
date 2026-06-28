import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { Breadcrumb } from '@/components/breadcrumb'
import { formatDateDisplay } from '@/lib/utils/date'
import { CancelBookingButton } from './cancel-booking-button'

const bookingRowSchema = z.object({
  id: z.string(),
  check_in: z.string().nullable(),
  check_out: z.string().nullable(),
  status: z.string().nullable().optional(),
  listings: z
    .object({
      id: z.string(),
      title: z.string(),
      area: z.string().nullable(),
    })
    .nullable()
    .optional(),
})

const statusBadge: Record<string, { label: string; className: string }> = {
  confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-700' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Cancelled', className: 'bg-stone-200 text-stone-500' },
  completed: { label: 'Completed', className: 'bg-stone-100 text-stone-600' },
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>
}) {
  const { payment } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/account/bookings')
  }

  const { data } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, status, listings(id, title, area)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const bookings = z.array(bookingRowSchema).parse(data ?? [])
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-6">
        <Breadcrumb items={[{ label: 'Account', href: '/account' }, { label: 'My trips' }]} />

        {payment === 'success' && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            <p className="font-semibold">Payment received — your stay is confirmed.</p>
            <p className="mt-1 text-green-700">
              Your booking is listed below. You can add it to your calendar from the booking.
            </p>
          </div>
        )}

        <header className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-stone-950">My trips</h1>
          <p className="mt-2 text-stone-600">Upcoming and past stays in one place.</p>
        </header>

        {bookings.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-stone-200 border-y border-stone-200">
            {bookings.map((booking) => {
              const status = booking.status || 'pending'
              const badge = statusBadge[status] || statusBadge.pending
              const isCancellable =
                status !== 'cancelled' &&
                status !== 'completed' &&
                Boolean(booking.check_in && booking.check_in >= today)

              return (
                <div
                  key={booking.id}
                  className="grid gap-3 py-5 transition hover:bg-white/50 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    <Link href={booking.listings?.id ? `/listings/${booking.listings.id}` : '/stays'}>
                      <p className="font-bold text-stone-950">{booking.listings?.title || 'Stay'}</p>
                      <p className="mt-1 text-sm text-stone-600">{booking.listings?.area || 'Jerusalem'}</p>
                      <p className="mt-2 text-sm font-medium text-stone-700">
                        {formatDateDisplay(booking.check_in)} to {formatDateDisplay(booking.check_out)}
                      </p>
                      {booking.check_in && booking.check_out && (
                        <span className="text-xs text-stone-500">
                          {Math.round(
                            (new Date(booking.check_out).getTime() -
                              new Date(booking.check_in).getTime()) /
                              (1000 * 60 * 60 * 24),
                          )} nights
                        </span>
                      )}
                    </Link>
                    <a
                      href={`/api/booking-calendar/${booking.id}`}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#c76f55] transition hover:underline"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      Add to calendar
                    </a>
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}>
                      {badge.label}
                    </span>
                    {isCancellable && <CancelBookingButton bookingId={booking.id} />}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
        <CalendarDays className="h-8 w-8 text-stone-400" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-stone-900">No trips yet</h2>
      <p className="mb-6 text-stone-600">When you book a stay, it will appear here.</p>
      <Link
        href="/stays"
        className="inline-flex rounded-full bg-[#c76f55] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b85f47]"
      >
        Start exploring
      </Link>
    </div>
  )
}
