import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type BookingListing = {
  title: string | null
  exact_address: string | null
  area: string | null
}

type BookingCalendarRow = {
  id: string
  check_in: string | null
  check_out: string | null
  user_id: string
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
    .select('id, check_in, check_out, user_id, listings(title, exact_address, area)')
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

  const listing = Array.isArray(booking.listings)
    ? booking.listings[0] || null
    : booking.listings
  const title = listing?.title || 'JLM Collective Stay'
  const location = listing?.exact_address || listing?.area || 'Jerusalem'
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
