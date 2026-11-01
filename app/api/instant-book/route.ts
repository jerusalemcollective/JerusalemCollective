import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  loadInstantBookingDetails,
  sendGuestInstantBookingEmail,
  sendHostNewInstantBookingEmail,
  type InstantBookingDetails,
} from '@/lib/transactional-email'

// Instant book for listings paid by bank transfer to the host (booking_type =
// 'instant' and no live JLM card payment). The card flow stays on /api/book-now.
// instant_book_listing (migration 116) validates the listing, dates and
// availability and writes the same rows a host accept does, all server-side.

type InstantBookBody = {
  listingId?: unknown
  checkIn?: unknown
  checkOut?: unknown
  guests?: unknown
}

type InstantBookResult = {
  booking_id?: string
  request_id?: string
  conversation_id?: string
  currency?: string | null
  total_amount_usd?: number | null
  total_amount_ils?: number | null
  already_booked?: boolean
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// RPC exception text -> what the guest sees (and the HTTP status).
const ERROR_MESSAGES: Array<[RegExp, string | ((match: RegExpMatchArray) => string), number]> = [
  [/not authenticated/i, 'Please sign in to book.', 401],
  [/no longer available/i, 'Sorry, those dates are no longer available. Please choose other dates.', 409],
  [/already being processed/i, 'We’re already working on this booking. Please refresh the page in a moment.', 409],
  [/check-out must be after check-in/i, 'Your check-out date needs to be after your check-in date.', 400],
  [/in the past/i, 'Please choose a check-in date that hasn’t passed yet.', 400],
  [/choose check-in/i, 'Choose check-in and check-out dates first.', 400],
  [/minimum stay is (\d+) nights/i, (match) => `This stay needs a booking of at least ${match[1]} nights.`, 400],
  [/sleeps up to (\d+) guests/i, (match) => `This stay sleeps up to ${match[1]} guests. Please choose fewer guests.`, 400],
  [/guest count/i, 'Choose at least 1 guest.', 400],
  [/does not offer instant booking/i, 'This stay can’t be booked straight away. Please send the host a booking request instead.', 400],
  [/online card payment/i, 'This stay is paid for online by card. Please refresh the page to book it that way.', 400],
  [/does not have a price/i, 'This stay doesn’t have a price yet. Please message the host.', 400],
  [/declined these dates/i, 'These dates aren’t available with this host. Please choose other dates, or message the host.', 409],
  [/your own listing/i, 'You can’t book your own listing.', 400],
  [/listing not available|listing is required|host not available/i, 'Sorry, this stay can’t be booked right now. Please try another stay, or message the host.', 400],
]

function mapRpcError(message: string): { error: string; status: number } {
  for (const [pattern, text, status] of ERROR_MESSAGES) {
    const match = message.match(pattern)
    if (!match) continue
    return { error: typeof text === 'function' ? text(match) : text, status }
  }
  return { error: 'We couldn’t complete your booking. Please try again.', status: 400 }
}

function paymentPayload(details: InstantBookingDetails | null) {
  return {
    acceptsDirect: details?.plan.acceptsDirect ?? false,
    total: details?.plan.total ?? null,
    schedule: details?.plan.schedule ?? [],
    howToPay: details?.plan.howToPay ?? [],
    instructions: details?.plan.instructions ?? null,
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as InstantBookBody | null
  const listingId = typeof body?.listingId === 'string' ? body.listingId : ''
  const checkIn = typeof body?.checkIn === 'string' ? body.checkIn : ''
  const checkOut = typeof body?.checkOut === 'string' ? body.checkOut : ''
  const guests = typeof body?.guests === 'number' && Number.isInteger(body.guests) ? body.guests : 1

  if (!listingId || !ISO_DATE.test(checkIn) || !ISO_DATE.test(checkOut)) {
    return NextResponse.json({ error: 'Choose check-in and check-out dates first.' }, { status: 400 })
  }
  if (guests < 1) {
    return NextResponse.json({ error: 'Choose at least 1 guest.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Please sign in to book.' }, { status: 401 })
  }

  const { data, error } = await supabase.rpc('instant_book_listing', {
    target_listing_id: listingId,
    check_in_date: checkIn,
    check_out_date: checkOut,
    guest_count: guests,
  })

  if (error) {
    console.error('[instant-book] rpc failed', error.message)
    const mapped = mapRpcError(error.message || '')
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }

  const result = (data || {}) as InstantBookResult
  if (!result.booking_id || !result.request_id) {
    return NextResponse.json({ error: 'We couldn’t complete your booking. Please try again.' }, { status: 500 })
  }

  // The booking is committed. Nothing below may turn this into an error.
  const bookingTotal =
    result.currency === 'USD'
      ? result.total_amount_usd ?? null
      : result.currency === 'ILS'
        ? result.total_amount_ils ?? null
        : null

  let details: InstantBookingDetails | null = null
  try {
    details = await loadInstantBookingDetails({
      supabase,
      requestId: result.request_id,
      bookingTotal,
    })
  } catch (detailsError) {
    console.error('[instant-book] could not load booking details', detailsError)
  }

  // A double click returns the existing booking without re-sending the emails.
  if (details && !result.already_booked) {
    try {
      const [guestSent, hostSent] = await Promise.all([
        sendGuestInstantBookingEmail(details),
        sendHostNewInstantBookingEmail({ supabase, details }),
      ])
      if (!guestSent || !hostSent) {
        console.error('[instant-book] email not sent', {
          bookingId: result.booking_id,
          guestSent,
          hostSent,
        })
      }
    } catch (emailError) {
      console.error('[instant-book] email failed', emailError)
    }
  }

  return NextResponse.json({
    ok: true,
    bookingId: result.booking_id,
    conversationId: result.conversation_id ?? null,
    alreadyBooked: Boolean(result.already_booked),
    payment: paymentPayload(details),
  })
}
