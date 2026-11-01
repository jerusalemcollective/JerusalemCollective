import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { oneOrNull } from '@/lib/utils/one-or-null'
import { readListingExactAddress } from '@/lib/listing-private-details'

// The street address is only for guests whose stay is actually booked. The
// same rule is enforced in the database by RLS on listing_private_details
// (migration 120); this check also covers the pre-migration fallback.
const ADDRESS_VISIBLE_STATUSES = new Set(['confirmed', 'completed'])

type BookingListing = {
  title: string | null
  area: string | null
}

type BookingCalendarRow = {
  id: string
  check_in: string | null
  check_out: string | null
  user_id: string
  listing_id: string | null
  status: string | null
  listings: BookingListing | BookingListing[] | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, user_id, listing_id, status, listings(title, area)')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const booking = data as BookingCalendarRow

  if (booking.user_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  if (!booking.check_in || !booking.check_out) {
    return NextResponse.json({ error: 'Booking dates are missing' }, { status: 400 })
  }

  const listing = oneOrNull(booking.listings)
  const title = listing?.title || 'JLM Collective Stay'
  let exactAddress: string | null = null
  if (booking.listing_id && booking.status && ADDRESS_VISIBLE_STATUSES.has(booking.status)) {
    const { address, error: addressError } = await readListingExactAddress(supabase, booking.listing_id)
    if (addressError) console.error('Could not load listing address for calendar file', booking.id, addressError)
    exactAddress = address
  }
  const location = exactAddress || listing?.area || 'Jerusalem'
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JLM Collective//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(`booking-${booking.id}@jlmcollective.co`)}`,
    `DTSTART;VALUE=DATE:${booking.check_in.replaceAll('-', '')}`,
    `DTEND;VALUE=DATE:${booking.check_out.replaceAll('-', '')}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `LOCATION:${escapeIcsText(location)}`,
    'DESCRIPTION:Booked via JLM Collective - jlmcollective.co',
    'ORGANIZER;CN=JLM Collective:mailto:hello@jlmcollective.co',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return new Response(icsContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="jlm-booking.ics"',
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
