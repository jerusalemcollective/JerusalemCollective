import { createServiceRoleClient } from '@/lib/supabase/service'
import { oneOrNull } from '@/lib/utils/one-or-null'
import { readListingExactAddresses } from '@/lib/listing-private-details'

type HostCalendarRow = {
  id: string
  name: string
}

type BookingListing = {
  title: string | null
  area: string | null
}

type BookingGuest = {
  full_name: string | null
}

type HostBookingRow = {
  id: string
  check_in: string
  check_out: string
  listing_id: string | null
  listings: BookingListing | BookingListing[] | null
  profiles: BookingGuest | BookingGuest[] | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await params
  const token = rawToken.replace(/\.ics$/, '')
  // Reject empty tokens so a request like `/.ics` can't match a host whose
  // calendar_token is unset/empty.
  if (!token) {
    return new Response('Calendar not found.', { status: 404 })
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Calendar feed is not configured.', { status: 500 })
  }

  const supabase = createServiceRoleClient(supabaseUrl, serviceRoleKey)
  const { data: host } = await supabase
    .from('hosts')
    .select('id, name')
    .eq('calendar_token', token)
    .single()

  if (!host) {
    return new Response('Calendar not found.', { status: 404 })
  }

  const hostRecord = host as HostCalendarRow
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, listing_id, listings(title, area), profiles!bookings_user_id_fkey(full_name)')
    .in('host_id', [hostRecord.id])
    .order('check_in', { ascending: true })

  const bookingRows = (bookings || []) as HostBookingRow[]
  // This feed is the host's own (token-authed), so the private address is
  // included. Service role: read from listing_private_details directly.
  const { addresses, error: addressError } = await readListingExactAddresses(
    supabase,
    bookingRows.map((booking) => booking.listing_id).filter((id): id is string => Boolean(id)),
  )
  if (addressError) console.error('Could not load listing addresses for host calendar', hostRecord.id, addressError)

  const events = bookingRows.map((booking) => {
    const listing = oneOrNull(booking.listings)
    const exactAddress = booking.listing_id ? addresses.get(booking.listing_id) : undefined
    const guest = oneOrNull(booking.profiles)

    return [
      'BEGIN:VEVENT',
      `UID:${escapeIcsText(`booking-${booking.id}@jlmcollective.co`)}`,
      `DTSTART;VALUE=DATE:${booking.check_in.replaceAll('-', '')}`,
      `DTEND;VALUE=DATE:${booking.check_out.replaceAll('-', '')}`,
      `SUMMARY:${escapeIcsText(`Guest stay - ${listing?.title || 'Your property'}`)}`,
      `LOCATION:${escapeIcsText(exactAddress || listing?.area || 'Jerusalem')}`,
      `DESCRIPTION:${escapeIcsText(`Guest: ${guest?.full_name || 'Guest'}. Managed via JLM Collective - jlmcollective.co`)}`,
      'END:VEVENT',
    ].join('\r\n')
  })

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JLM Collective//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`JLM Collective - ${hostRecord.name}`)}`,
    'X-WR-TIMEZONE:Asia/Jerusalem',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

  return new Response(icsContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}

function escapeIcsText(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;')
}
