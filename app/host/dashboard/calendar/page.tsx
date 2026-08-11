import {
  HostCalendarBoard,
  type CalendarEvent,
} from '@/components/host-calendar-board'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import {
  saveCalendarEntry,
  updateBookingAsHost,
  updateRequestAsHost,
  removeUnavailableRange,
} from './actions'
import { ExternalCalendarSyncForm } from '@/components/external-calendar-sync-form'
import { CopyCalendarUrlButton } from '@/components/copy-calendar-url-button'
import { oneOrNull } from '@/lib/utils/one-or-null'

type HostListing = {
  id: string
  title: string
  external_calendar_url: string | null
  calendar_last_synced_at: string | null
}

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
  guest_name: string | null
  guest_count: number | null
  guest_email: string | null
  guest_phone: string | null
  notes: string | null
  listings?: { title: string } | { title: string }[] | null
}

export default async function HostCalendarPage() {
  const { supabase, hostIds } = await requireHostDashboardAccess()
  const [
    { data: listings },
    { data: ranges },
    { data: bookingsData },
    { data: requestsData },
    { data: hostContact },
  ] = await Promise.all([
    supabase
      .from('listings')
      .select('id, title, external_calendar_url, calendar_last_synced_at')
      .in('host_id', hostIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('listing_unavailable_ranges')
      .select('id, listing_id, start_date, end_date, reason, source, guest_name, guest_count, guest_email, guest_phone, notes, listings(title)')
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
    // calendar_token is only readable through this definer (migration 074).
    supabase
      .rpc('get_my_host_contact')
      .maybeSingle<{ host_id: string; email: string | null; calendar_token: string | null }>(),
  ])

  const hostListings: HostListing[] = (listings || []).map((listing: HostListing) => ({
    id: listing.id,
    title: listing.title,
    external_calendar_url: listing.external_calendar_url,
    calendar_last_synced_at: listing.calendar_last_synced_at,
  }))

  const bookingRows = (bookingsData || []) as BookingRow[]
  const requestRows = (requestsData || []) as RequestRow[]
  const rangeRows = (ranges || []) as RangeRow[]

  // One unified list of calendar events. Each occupies its dates on the grid and
  // opens its own details/edit popup when clicked.
  const events: CalendarEvent[] = [
    ...bookingRows.map((booking): CalendarEvent => ({
      id: booking.id,
      kind: 'booking',
      listingId: booking.listing_id,
      listingTitle: oneOrNull(booking.listings)?.title || 'Stay',
      start: booking.check_in,
      endExclusive: booking.check_out,
      guestName: oneOrNull(booking.profiles)?.full_name ?? null,
      guests: booking.guests,
      status: booking.status,
      reason: null,
      removable: false,
      external: false,
    })),
    ...requestRows
      .filter((request) => request.check_in && request.check_out)
      .map((request): CalendarEvent => ({
        id: request.id,
        kind: 'request',
        listingId: request.listing_id,
        listingTitle: oneOrNull(request.listings)?.title || 'Stay',
        start: request.check_in as string,
        endExclusive: request.check_out as string,
        guestName: oneOrNull(request.guest)?.full_name ?? null,
        guests: request.guests,
        status: request.status,
        reason: null,
        removable: false,
        external: false,
      })),
    ...rangeRows
      // 'booking'-sourced ranges are already covered by the bookings table.
      .filter((range) => range.source !== 'booking')
      .map((range): CalendarEvent => {
        const isManualBooking = range.source === 'manual_booking'
        const isExternal = range.source === 'external_calendar'
        // Older manual bookings kept the name only in "reason" as "Booking — X".
        const legacyName = range.reason?.replace(/^Booking\s*[—-]\s*/, '') || null
        return {
          id: range.id,
          kind: isManualBooking ? 'manual_booking' : 'block',
          listingId: range.listing_id,
          listingTitle: oneOrNull(range.listings)?.title || 'Stay',
          start: range.start_date,
          endExclusive: range.end_date,
          guestName: isManualBooking ? range.guest_name || legacyName : null,
          guests: isManualBooking ? range.guest_count : null,
          status: null,
          reason: range.reason,
          removable: !isExternal,
          external: isExternal,
          guestEmail: isManualBooking ? range.guest_email : null,
          guestPhone: isManualBooking ? range.guest_phone : null,
          notes: isManualBooking ? range.notes : null,
        }
      }),
  ]

  const calendarUrl = hostContact?.calendar_token
    ? `https://jlmcollective.co/api/host-calendar/${hostContact.calendar_token}.ics`
    : null

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
              events={events}
              saveAction={saveCalendarEntry}
              updateBookingAction={updateBookingAsHost}
              updateRequestAction={updateRequestAsHost}
              removeRangeAction={removeUnavailableRange}
            />

            <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-stone-950">Connect your calendar</h2>

              <div className="mt-4">
                <p className="text-sm font-semibold text-stone-900">
                  Block dates from Airbnb, Booking.com or another calendar
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  Paste an iCal link — we check it hourly and block those dates automatically.
                </p>
                <div className="mt-3 space-y-4">
                  {hostListings.map((listing) => (
                    <div key={listing.id}>
                      {hostListings.length > 1 && (
                        <p className="mb-2 text-sm font-bold text-stone-700">{listing.title}</p>
                      )}
                      <ExternalCalendarSyncForm
                        listingId={listing.id}
                        externalCalendarUrl={listing.external_calendar_url}
                        calendarLastSyncedAt={listing.calendar_last_synced_at}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 border-t border-stone-100 pt-6">
                <p className="text-sm font-semibold text-stone-900">See your JLM bookings in your own calendar</p>
                <p className="mt-1 text-sm text-stone-600">Add this private link to Google or Apple Calendar.</p>
                {calendarUrl ? (
                  <>
                    <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                      <input
                        readOnly
                        value={calendarUrl}
                        className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-sm text-stone-700"
                      />
                      <CopyCalendarUrlButton value={calendarUrl} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <a
                        href="https://calendar.google.com/calendar/r/settings/addbyurl"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-[#c76f55] hover:underline"
                      >
                        Add to Google Calendar -&gt;
                      </a>
                      <a
                        href="https://support.apple.com/guide/icloud/set-up-icloud-calendar-mm6902b8ad/icloud"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-stone-500 hover:underline"
                      >
                        Add to Apple Calendar -&gt;
                      </a>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 rounded-2xl bg-[#F8F5F2] p-4 text-sm text-stone-600">
                    Your private calendar link will appear after the calendar token migration has been run.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </section>
    </div>
  )
}
