import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/service'
import {
  bookingGuestName,
  bookingTotal,
  formatDateRange,
  formatGuestCount,
  formatMoney,
} from '@/lib/booking-display'
import { detailTableHtml, escapeHtml, getAuthUserEmail, sendEmail } from '@/lib/transactional-email'

// Short copies of booking activity for the JLM team inbox. Every send here is an
// ADDITIONAL email: callers fire it next to the existing guest/host emails, and
// each function catches and logs its own errors and returns false instead of
// throwing, so a team-copy failure can never block a booking action.

export const BOOKINGS_TEAM_EMAIL = 'bookings@jlmcollective.co'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.jlmcollective.co'

// How the guest pays: card through JLM (Stripe), bank transfer to the host, or an
// off-platform booking the host recorded themselves.
export type TeamPaymentRoute = 'card' | 'transfer' | 'manual'

type TeamBooking = {
  requestId: string | null
  requestStatus: string | null
  bookingId: string | null
  guestName: string
  guestEmail: string | null
  listingTitle: string
  hostName: string
  checkIn: string | null
  checkOut: string | null
  guests: number | null
  message: string | null
  total: string | null
  paidByCardThroughJlm: boolean
}

type RequestRow = {
  id: string
  listing_id: string | null
  host_id: string | null
  guest_id: string | null
  check_in: string | null
  check_out: string | null
  guests: number | null
  status: string | null
  booking_id: string | null
  message: string | null
}

type BookingRow = {
  id: string
  user_id: string | null
  listing_id: string | null
  host_id: string | null
  check_in: string | null
  check_out: string | null
  guests: number | null
  total_amount_usd: number | null
  total_amount_ils: number | null
}

type PaymentRow = {
  currency: string | null
  payment_mode: string | null
  status: string | null
}

// Team copies read rows the acting user may not see under RLS (the other party's
// profile, host names, payments), so they always use the service role.
function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('[booking-team-email] missing Supabase service env; team copy not sent')
    return null
  }
  return createServiceRoleClient(url, key)
}

async function loadParts(
  db: SupabaseClient,
  {
    listingId,
    hostId,
    guestId,
    bookingId,
  }: { listingId: string | null; hostId: string | null; guestId: string | null; bookingId: string | null },
) {
  const [{ data: listing }, { data: host }, { data: profile }, { data: booking }, { data: payments }, guestEmail] =
    await Promise.all([
      listingId
        ? db.from('listings').select('title').eq('id', listingId).maybeSingle<{ title: string | null }>()
        : Promise.resolve({ data: null }),
      hostId
        ? db.from('hosts').select('name').eq('id', hostId).maybeSingle<{ name: string | null }>()
        : Promise.resolve({ data: null }),
      guestId
        ? db.from('profiles').select('full_name').eq('id', guestId).maybeSingle<{ full_name: string | null }>()
        : Promise.resolve({ data: null }),
      bookingId
        ? db
            .from('bookings')
            .select('total_amount_usd, total_amount_ils')
            .eq('id', bookingId)
            .maybeSingle<Pick<BookingRow, 'total_amount_usd' | 'total_amount_ils'>>()
        : Promise.resolve({ data: null }),
      bookingId
        ? db.from('booking_payments').select('currency, payment_mode, status').eq('booking_id', bookingId)
        : Promise.resolve({ data: null }),
      guestId ? getAuthUserEmail(guestId) : Promise.resolve(null),
    ])

  const paymentRows = (payments || []) as PaymentRow[]
  const cardPayment = paymentRows.find(
    (row) => row.payment_mode === 'platform_checkout' && (row.status === 'paid' || row.status === 'refunded'),
  )
  const total = booking ? bookingTotal(booking, cardPayment?.currency || paymentRows[0]?.currency) : null

  return {
    listingTitle: listing?.title?.trim() || 'Untitled listing',
    hostName: host?.name?.trim() || 'Unknown host',
    guestName: bookingGuestName({ full_name: profile?.full_name, email: guestEmail }),
    guestEmail,
    total: total ? `${formatMoney(total.amount, total.currency)} ${total.currency}` : null,
    paidByCardThroughJlm: Boolean(cardPayment),
  }
}

async function loadFromRequest(db: SupabaseClient, requestId: string): Promise<TeamBooking | null> {
  const { data: request } = await db
    .from('booking_requests')
    .select('id, listing_id, host_id, guest_id, check_in, check_out, guests, status, booking_id, message')
    .eq('id', requestId)
    .maybeSingle<RequestRow>()
  if (!request) return null

  const parts = await loadParts(db, {
    listingId: request.listing_id,
    hostId: request.host_id,
    guestId: request.guest_id,
    bookingId: request.booking_id,
  })
  return {
    ...parts,
    requestId: request.id,
    requestStatus: request.status,
    bookingId: request.booking_id,
    checkIn: request.check_in,
    checkOut: request.check_out,
    guests: request.guests,
    message: request.message,
  }
}

async function loadFromBooking(db: SupabaseClient, bookingId: string): Promise<TeamBooking | null> {
  const { data: booking } = await db
    .from('bookings')
    .select('id, user_id, listing_id, host_id, check_in, check_out, guests, total_amount_usd, total_amount_ils')
    .eq('id', bookingId)
    .maybeSingle<BookingRow>()
  if (!booking) return null

  const parts = await loadParts(db, {
    listingId: booking.listing_id,
    hostId: booking.host_id,
    guestId: booking.user_id,
    bookingId: booking.id,
  })
  return {
    ...parts,
    requestId: null,
    requestStatus: null,
    bookingId: booking.id,
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    guests: booking.guests,
    message: null,
  }
}

function paymentLabel(route: TeamPaymentRoute | null, booking: Pick<TeamBooking, 'paidByCardThroughJlm'>) {
  if (route === 'card') return 'Card through JLM'
  if (route === 'transfer') return 'Bank transfer to host'
  if (route === 'manual') return 'Paid to host off-platform (host-recorded booking)'
  return booking.paidByCardThroughJlm ? 'Card through JLM' : 'Bank transfer to host'
}

function teamEmailHtml({
  intro,
  rows,
  ctaUrl,
  ctaLabel,
}: {
  intro: string
  rows: [string, string][]
  ctaUrl: string
  ctaLabel: string
}) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#292524">
      <p>Hi JLM team,</p>
      <p>${escapeHtml(intro)}</p>
      ${detailTableHtml(rows)}
      <p>
        <a href="${ctaUrl}" style="display:inline-block;background:#c76f55;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:700">
          ${escapeHtml(ctaLabel)}
        </a>
      </p>
      <p>JLM Collective</p>
    </div>
  `
}

function guestRow(booking: Pick<TeamBooking, 'guestName' | 'guestEmail'>): [string, string] {
  const email = booking.guestEmail && booking.guestEmail !== booking.guestName ? ` (${booking.guestEmail})` : ''
  return ['Guest', `${booking.guestName}${email}`]
}

function adminBookingUrl(bookingId: string | null) {
  return bookingId ? `${siteUrl}/admin/bookings/${bookingId}` : `${siteUrl}/admin/bookings`
}

// True when userId is the host on this request (hosts.id or hosts.user_id), so a
// signed-in route can refuse to send team copies for someone else's request.
export async function isRequestHost(requestId: string, userId: string): Promise<boolean> {
  try {
    const db = serviceClient()
    if (!db) return false
    const { data: request } = await db
      .from('booking_requests')
      .select('host_id')
      .eq('id', requestId)
      .maybeSingle<{ host_id: string | null }>()
    if (!request?.host_id) return false
    if (request.host_id === userId) return true
    const { data: host } = await db
      .from('hosts')
      .select('user_id')
      .eq('id', request.host_id)
      .maybeSingle<{ user_id: string | null }>()
    return host?.user_id === userId
  } catch (error) {
    console.error('[booking-team-email] host check failed', error)
    return false
  }
}

// 1. A guest's dated request to book (not a plain message).
export async function sendTeamNewBookingRequestEmail({ requestId }: { requestId: string }) {
  try {
    const db = serviceClient()
    if (!db) return false
    const booking = await loadFromRequest(db, requestId)
    if (!booking) return false
    // Only dated requests are requests to book; an undated enquiry is a message.
    if (!booking.checkIn || !booking.checkOut) return false
    if (booking.requestStatus !== 'new' && booking.requestStatus !== 'host_replied') return false

    const dates = formatDateRange(booking.checkIn, booking.checkOut)
    const guests = formatGuestCount(booking.guests)
    const rows: [string, string][] = [
      guestRow(booking),
      ['Listing', booking.listingTitle],
      ['Host', booking.hostName],
      ['Dates', dates],
      ['Guests', guests],
    ]
    if (booking.message?.trim()) rows.push(['Message', booking.message.trim()])

    return await sendEmail({
      to: BOOKINGS_TEAM_EMAIL,
      subject: `New booking request: ${booking.guestName} → ${booking.listingTitle}, ${dates}, ${guests}`,
      html: teamEmailHtml({
        intro: `${booking.guestName} sent a request to book ${booking.listingTitle}. The host has been notified.`,
        rows,
        ctaUrl: `${siteUrl}/admin/enquiries`,
        ctaLabel: 'Open enquiries',
      }),
    })
  } catch (error) {
    console.error('[booking-team-email] new request copy failed', error)
    return false
  }
}

const CONFIRMED_HOW: Record<'accepted' | 'instant' | 'card', string> = {
  accepted: 'Host accepted the request',
  instant: 'Instant book',
  card: 'Instant book, paid by card',
}

async function sendConfirmed(booking: TeamBooking, route: TeamPaymentRoute | null, how: string) {
  const dates = formatDateRange(booking.checkIn, booking.checkOut)
  const rows: [string, string][] = [
    guestRow(booking),
    ['Listing', booking.listingTitle],
    ['Host', booking.hostName],
    ['Dates', dates],
    ['Guests', formatGuestCount(booking.guests)],
    ['Total', booking.total || 'Not recorded'],
    ['Payment', paymentLabel(route, booking)],
    ['How', how],
  ]

  return await sendEmail({
    to: BOOKINGS_TEAM_EMAIL,
    subject: `Booking confirmed: ${booking.guestName} at ${booking.listingTitle}, ${dates}`,
    html: teamEmailHtml({
      intro: `A booking at ${booking.listingTitle} is confirmed.`,
      rows,
      ctaUrl: adminBookingUrl(booking.bookingId),
      ctaLabel: 'Open in Admin',
    }),
  })
}

// 2. A booking was confirmed on the platform: host accept (requestId), instant
// book by transfer (requestId) or by card (Stripe sessionId).
export async function sendTeamBookingConfirmedEmail(source: {
  requestId?: string
  sessionId?: string
  route?: TeamPaymentRoute
  how: 'accepted' | 'instant' | 'card'
}) {
  try {
    const db = serviceClient()
    if (!db) return false

    let booking: TeamBooking | null = null
    if (source.requestId) {
      booking = await loadFromRequest(db, source.requestId)
      // Never announce a confirmation for a request that isn't accepted.
      if (booking && booking.requestStatus !== 'accepted') return false
    } else if (source.sessionId) {
      const { data: payment } = await db
        .from('booking_payments')
        .select('booking_id')
        .eq('stripe_checkout_session_id', source.sessionId)
        .maybeSingle<{ booking_id: string | null }>()
      if (payment?.booking_id) booking = await loadFromBooking(db, payment.booking_id)
    }
    if (!booking) return false

    return await sendConfirmed(booking, source.route ?? null, CONFIRMED_HOW[source.how])
  } catch (error) {
    console.error('[booking-team-email] confirmed copy failed', error)
    return false
  }
}

type ManualBookingInput = {
  hostName: string | null
  listingTitle: string
  guestName: string | null
  guestEmail: string | null
  checkIn: string
  checkOut: string
  guests: number | null
}

// A host-recorded manual booking has no bookings row: build the team view from
// what the host entered.
function manualBooking(input: ManualBookingInput): TeamBooking {
  return {
    requestId: null,
    requestStatus: null,
    bookingId: null,
    guestName: bookingGuestName({ full_name: input.guestName, email: input.guestEmail }),
    guestEmail: input.guestEmail,
    listingTitle: input.listingTitle,
    hostName: input.hostName?.trim() || 'Unknown host',
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guests: input.guests,
    message: null,
    total: null,
    paidByCardThroughJlm: false,
  }
}

// 2 (manual). A host recorded an off-platform booking in their calendar. There is
// no bookings row, so the details come straight from the form.
export async function sendTeamManualBookingEmail({
  hostName,
  listingTitle,
  guestName,
  guestEmail,
  checkIn,
  checkOut,
  guests,
}: ManualBookingInput) {
  try {
    return await sendConfirmed(
      manualBooking({ hostName, listingTitle, guestName, guestEmail, checkIn, checkOut, guests }),
      'manual',
      'Host recorded a manual booking in their calendar',
    )
  } catch (error) {
    console.error('[booking-team-email] manual booking copy failed', error)
    return false
  }
}

// 3. A confirmed booking was cancelled by the guest or the host.
export async function sendTeamBookingCancelledEmail({
  bookingId,
  cancelledBy,
}: {
  bookingId: string
  cancelledBy: 'guest' | 'host'
}) {
  try {
    const db = serviceClient()
    if (!db) return false
    const booking = await loadFromBooking(db, bookingId)
    if (!booking) return false

    return await sendCancelled(booking, null, cancelledBy)
  } catch (error) {
    console.error('[booking-team-email] cancelled copy failed', error)
    return false
  }
}

// 3 (manual). A host removed a manual booking they had recorded in their calendar.
export async function sendTeamManualBookingCancelledEmail({
  hostName,
  listingTitle,
  guestName,
  guestEmail,
  checkIn,
  checkOut,
  guests,
}: ManualBookingInput) {
  try {
    return await sendCancelled(
      manualBooking({ hostName, listingTitle, guestName, guestEmail, checkIn, checkOut, guests }),
      'manual',
      'host',
    )
  } catch (error) {
    console.error('[booking-team-email] manual booking cancelled copy failed', error)
    return false
  }
}

async function sendCancelled(booking: TeamBooking, route: TeamPaymentRoute | null, cancelledBy: 'guest' | 'host') {
  const dates = formatDateRange(booking.checkIn, booking.checkOut)
  const rows: [string, string][] = [
    guestRow(booking),
    ['Listing', booking.listingTitle],
    ['Host', booking.hostName],
    ['Dates', dates],
    ['Guests', formatGuestCount(booking.guests)],
    ['Total', booking.total || 'Not recorded'],
    ['Payment', paymentLabel(route, booking)],
    ['Cancelled by', cancelledBy === 'guest' ? 'The guest' : 'The host'],
  ]

  return await sendEmail({
    to: BOOKINGS_TEAM_EMAIL,
    subject: `Booking cancelled: ${booking.guestName} at ${booking.listingTitle}, ${dates}`,
    html: teamEmailHtml({
      intro: `The ${cancelledBy} cancelled a booking at ${booking.listingTitle}.`,
      rows,
      ctaUrl: adminBookingUrl(booking.bookingId),
      ctaLabel: 'Open in Admin',
    }),
  })
}

// 4. The host declined a guest's request.
export async function sendTeamRequestDeclinedEmail({ requestId }: { requestId: string }) {
  try {
    const db = serviceClient()
    if (!db) return false
    const booking = await loadFromRequest(db, requestId)
    if (!booking || booking.requestStatus !== 'declined') return false

    const dates = formatDateRange(booking.checkIn, booking.checkOut)
    const rows: [string, string][] = [
      guestRow(booking),
      ['Listing', booking.listingTitle],
      ['Host', booking.hostName],
      ['Dates', dates],
      ['Guests', formatGuestCount(booking.guests)],
    ]

    return await sendEmail({
      to: BOOKINGS_TEAM_EMAIL,
      subject: `Request declined: ${booking.guestName} → ${booking.listingTitle}, ${dates}`,
      html: teamEmailHtml({
        intro: `${booking.hostName} declined ${booking.guestName}'s request for ${booking.listingTitle}.`,
        rows,
        ctaUrl: `${siteUrl}/admin/enquiries`,
        ctaLabel: 'Open enquiries',
      }),
    })
  } catch (error) {
    console.error('[booking-team-email] declined copy failed', error)
    return false
  }
}
