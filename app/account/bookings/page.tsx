import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Breadcrumb } from '@/components/breadcrumb'

type BookingRow = {
  id: string
  check_in: string | null
  check_out: string | null
  listings?: {
    id: string
    title: string
    area: string | null
  } | null
}

export default async function BookingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/account/bookings')
  }

  const { data } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, listings(id, title, area)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const bookings = (data || []) as BookingRow[]

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-6">
        <Breadcrumb items={[{ label: 'Account', href: '/account' }, { label: 'My trips' }]} />

        <header className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-stone-950">My trips</h1>
          <p className="mt-2 text-stone-600">Upcoming and past stays in one place.</p>
        </header>

        {bookings.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-stone-200 border-y border-stone-200">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="grid gap-3 py-5 transition hover:bg-white/50 md:grid-cols-[1fr_auto] md:items-center"
              >
                <Link href={booking.listings?.id ? `/listings/${booking.listings.id}` : '/stays'}>
                  <p className="font-bold text-stone-950">{booking.listings?.title || 'Stay'}</p>
                  <p className="mt-1 text-sm text-stone-600">{booking.listings?.area || 'Jerusalem'}</p>
                  <p className="mt-2 text-sm font-medium text-stone-700">
                    {formatDate(booking.check_in)} to {formatDate(booking.check_out)}
                  </p>
                </Link>
                <div className="flex flex-col items-start gap-2 md:items-end">
                  <span className="w-fit rounded-full bg-stone-200 px-3 py-1 text-xs font-bold capitalize text-stone-700">
                    Booking
                  </span>
                  <a
                    href={`/api/booking-calendar/${booking.id}`}
                    className="text-xs font-semibold text-[#c76f55] hover:underline"
                  >
                    Add to calendar
                  </a>
                </div>
              </div>
            ))}
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
        className="inline-flex rounded-full bg-[#c76f55] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b5624a]"
      >
        Start exploring
      </Link>
    </div>
  )
}

function formatDate(value?: string | null) {
  if (!value) return 'TBC'
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
