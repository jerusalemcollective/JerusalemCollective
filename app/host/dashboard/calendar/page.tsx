import {
  HostCalendarBoard,
  type CalendarBooking,
  type CalendarRange,
} from '@/components/host-calendar-board'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { saveCalendarEntry, updateBookingAsHost, updateRequestAsHost } from './actions'
import { RemoveBlockedDateButton } from '@/components/remove-blocked-date-button'
import { HostBookingEditor, type EditableBooking } from '@/components/host-booking-editor'

type HostListing = { id: string; title: string }

type BookingRow = {
  id: string
  listing_id: string
  check_in: string
  check_out: string
  guests: number | null
  status: string
  listings?: { title: string } | { title: string }[] | null
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null
}

type RequestRow = {
  id: string
  listing_id: string
  check_in: string | null
  check_out: string | null
  guests: number | null
  status: string
  listings?: { title: string } | { title: string }[] | null
  guest?: { full_name: string | null } | { full_name: string | null }[] | null
}

type RangeRow = {
  id: string
  listing_id: string
  start_date: string
  end_date: string
  reason: string | null
  source: string
  listings?: { title: string } | { title: string }[] | null
}

function oneOrNull<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null
  return rel ?? null
}

export default async function HostCalendarPage() {
  const { supabase, hostIds } = await requireHostDashboardAccess()
  const [{ data: listings }, { data: ranges }, { data: bookingsData }, { data: requestsData }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, title')
      .in('host_id', hostIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('listing_unavailable_ranges')
      .select('id, listing_id, start_date, end_date, reason, source, listings(title)')
      .in('host_id', hostIds)
      .order('start_date', { ascending: true }),
    supabase
      .from('bookings')
      .select('id, listing_id, check_in, check_out, guests, status, listings(title), profiles!bookings_user_id_fkey(full_name)')
      .in('host_id', hostIds)
      .in('status', ['confirmed', 'pending', 'completed']),
    supabase
      .from('booking_requests')
      .select('id, listing_id, check_in, check_out, guests, status, listings(title), guest:profiles!booking_requests_guest_id_fkey(full_name)')
      .in('host_id', hostIds)
      .in('status', ['new', 'host_replied', 'accepted'])
      .order('check_in', { ascending: true }),
  ])

  const hostListings: HostListing[] = (listings || []).map((listing: HostListing) => ({
    id: listing.id,
    title: listing.title,
  }))

  const bookingRows = (bookingsData || []) as BookingRow[]
  const bookings: CalendarBooking[] = bookingRows.map((booking) => ({
    listing_id: booking.listing_id,
    check_in: booking.check_in,
    check_out: booking.check_out,
    status: booking.status,
    guest_name: oneOrNull(booking.profiles)?.full_name ?? null,
  }))

  const today = new Date().toISOString().slice(0, 10)
  const editableBookings: EditableBooking[] = bookingRows
    .filter((booking) => booking.check_out >= today)
    .map((booking) => ({
      id: booking.id,
      listingTitle: oneOrNull(booking.listings)?.title || 'Stay',
      guestName: oneOrNull(booking.profiles)?.full_name ?? null,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      guests: booking.guests ?? 1,
      status: booking.status,
    }))

  const editableRequests: EditableBooking[] = ((requestsData || []) as RequestRow[]).map((request) => ({
    id: request.id,
    listingTitle: oneOrNull(request.listings)?.title || 'Stay',
    guestName: oneOrNull(request.guest)?.full_name ?? null,
    checkIn: request.check_in || '',
    checkOut: request.check_out || '',
    guests: request.guests ?? 1,
    status: request.status,
  }))

  const rangeRows = (ranges || []) as RangeRow[]
  const calendarRanges: CalendarRange[] = rangeRows.map((range) => ({
    listing_id: range.listing_id,
    start_date: range.start_date,
    end_date: range.end_date,
    reason: range.reason,
    source: range.source,
  }))

  const manualEntries = rangeRows
    .filter((range) => range.source === 'manual' || range.source === 'manual_booking')
    .map((range) => ({
      id: range.id,
      start_date: range.start_date,
      end_date: range.end_date,
      reason: range.reason,
      source: range.source,
      title: oneOrNull(range.listings)?.title || 'Stay',
    }))

  return (
    <div className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Host dashboard</p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-stone-950">Calendar</h1>
        </div>

        {hostListings.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-sm text-stone-600 shadow-sm">
            Your calendar will appear once you have a live listing.
          </div>
        ) : (
          <>
            <HostCalendarBoard
              listings={hostListings}
              bookings={bookings}
              ranges={calendarRanges}
              saveAction={saveCalendarEntry}
            />

            <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="border-b border-stone-100 px-6 py-4">
                <h2 className="text-lg font-bold text-stone-950">Bookings and requests</h2>
                <p className="mt-1 text-sm text-stone-600">
                  Edit the dates, guests, or status. Changing a paid booking&rsquo;s dates does not re-price the
                  deposit or balance.
                </p>
              </div>
              <HostBookingEditor
                bookings={editableBookings}
                requests={editableRequests}
                updateBookingAction={updateBookingAsHost}
                updateRequestAction={updateRequestAsHost}
              />
            </section>

            <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="border-b border-stone-100 px-6 py-4">
                <h2 className="text-lg font-bold text-stone-950">Blocks and manual bookings</h2>
              </div>

              {manualEntries.length === 0 ? (
                <div className="px-6 py-10 text-center text-stone-500">
                  No blocks or manual bookings yet.
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {manualEntries.map((range) => (
                    <div
                      key={range.id}
                      className="grid gap-4 px-6 py-5 md:grid-cols-[1fr_0.8fr_auto] md:items-center"
                    >
                      <div>
                        <p className="font-bold text-stone-950">{range.title}</p>
                        <p className="mt-1 text-sm text-stone-500">
                          <span
                            className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              range.source === 'manual_booking'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {range.source === 'manual_booking' ? 'Booking' : 'Blocked'}
                          </span>
                          {range.reason || 'Unavailable'}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-stone-700">
                        {formatDate(range.start_date)} - {formatDate(range.end_date)}
                      </p>
                      <RemoveBlockedDateButton rangeId={range.id} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </div>
  )
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
