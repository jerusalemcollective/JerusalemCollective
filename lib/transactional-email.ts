import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { formatPayoutRows, resolveHostPayout } from '@/lib/direct-payment'
import { oneOrNull } from '@/lib/utils/one-or-null'
import { computeDepositPreview } from '@/lib/utils/deposit'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.jlmcollective.co'

// After migration 074 the authenticated role can no longer read hosts.email, so
// reads that need a host's email must use the service role (this is a server-only
// module). Falls back to the passed client only if the service key is missing.
function hostReader(fallback: SupabaseClient): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return fallback
  return createServiceRoleClient(url, key)
}

// Build a one-time magic-link that signs the recipient in and lands them on
// `path`, so an emailed link works without a manual sign-in. The link points at
// our own /auth/callback (which verifies the token_hash and sets the session),
// so no Supabase redirect-allowlist entry is needed. Falls back to a plain link
// (which prompts for login) if a link can't be generated.
async function recipientMagicLink(email: string, path: string): Promise<string> {
  const fallback = `${siteUrl}${path}`
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return fallback

  try {
    const admin = createServiceRoleClient(url, key)
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    const hashedToken = data?.properties?.hashed_token
    if (error || !hashedToken) {
      console.error('Magic link generation failed; using plain link', error)
      return fallback
    }

    return `${siteUrl}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink&next=${encodeURIComponent(path)}`
  } catch (error) {
    console.error('Magic link generation threw; using plain link', error)
    return fallback
  }
}

type HostEmailRow = {
  id: string
  user_id?: string | null
  name: string | null
  email: string | null
  notify_new_enquiry_email?: boolean | null
  notify_booking_confirmed_email?: boolean | null
}

// The host's contact email. Prefer the hosts.email column, but fall back to the
// account's auth email (hosts.email can be null or stale for accounts that never
// ran the become-host self-service path). Without this, host emails silently
// no-op when hosts.email is empty.
async function resolveHostEmail(host: HostEmailRow | null): Promise<string | null> {
  if (!host) return null
  if (host.email) return host.email
  const authId = host.user_id || host.id
  if (!authId) return null
  return await getAuthUserEmail(authId)
}

type ListingEmailRow = {
  id: string
  title: string | null
  host_id: string | null
  hosts?: {
    name: string | null
    email: string | null
  } | null
}

type BookingRequestEmailRow = {
  id: string
  listing_id: string | null
  host_id: string | null
  guest_id: string | null
  check_in: string | null
  check_out: string | null
  guests: number | null
  message: string | null
}

type ConversationEmailRow = {
  id: string
  listing_id: string | null
  participant_1: string
  participant_2: string
}

type MessageEmailRow = {
  content: string
  created_at: string
}

type ProfileEmailRow = {
  full_name: string | null
}

type HostMessageEmailRow = {
  id: string
  user_id?: string | null
  name: string | null
  display_name?: string | null
  email: string | null
  notify_messages_email?: boolean | null
}

type ConversationRequestEmailRow = {
  guest_email?: string | null
}

export async function sendHostAdminUpdateEmail({
  supabase,
  hostId,
  subject,
  intro,
  ctaPath,
  ctaLabel = 'Open host dashboard',
}: {
  supabase: SupabaseClient
  hostId: string
  subject: string
  intro: string
  ctaPath: string
  ctaLabel?: string
}) {
  try {
    const { data: host } = await hostReader(supabase)
      .from('hosts')
      .select('id, name, email')
      .eq('id', hostId)
      .maybeSingle<HostEmailRow>()

    if (!host?.email) return

    const ctaUrl = await recipientMagicLink(host.email, ctaPath)
    await sendEmail({
      to: host.email,
      subject,
      html: baseEmailHtml({
        greeting: `Hi ${escapeHtml(host?.name || 'there')},`,
        intro,
        ctaLabel,
        ctaUrl,
        showSignInHint: false,
      }),
    })
  } catch (error) {
    console.error('Unable to send host admin update email', error)
  }
}

export async function sendListingHostAdminUpdateEmail({
  supabase,
  listingId,
  subject,
  intro,
  ctaPath,
  ctaLabel = 'Open host dashboard',
}: {
  supabase: SupabaseClient
  listingId: string
  subject: string
  intro: string
  ctaPath: string
  ctaLabel?: string
}) {
  try {
    const { data: listing } = await hostReader(supabase)
      .from('listings')
      .select('id, title, host_id, hosts(name, email)')
      .eq('id', listingId)
      .maybeSingle<ListingEmailRow>()

    const email = listing?.hosts?.email
    if (!email) return

    const ctaUrl = await recipientMagicLink(email, ctaPath)
    await sendEmail({
      to: email,
      subject,
      html: baseEmailHtml({
        greeting: `Hi ${escapeHtml(listing.hosts?.name || 'there')},`,
        intro,
        ctaLabel,
        ctaUrl,
        showSignInHint: false,
      }),
    })
  } catch (error) {
    console.error('Unable to send listing host admin update email', error)
  }
}

export async function sendHostNewEnquiryEmail({
  supabase,
  requestId,
}: {
  supabase: SupabaseClient
  requestId: string
}) {
  try {
    const { data: request } = await supabase
      .from('booking_requests')
      .select('id, listing_id, host_id, guest_id, check_in, check_out, guests, message')
      .eq('id', requestId)
      .maybeSingle<BookingRequestEmailRow>()

    if (!request?.host_id || !request.listing_id) return false

    const [{ data: host }, { data: listing }, { data: guest }] = await Promise.all([
      hostReader(supabase)
        .from('hosts')
        .select('id, user_id, name, email, notify_new_enquiry_email')
        .eq('id', request.host_id)
        .maybeSingle<HostEmailRow>(),
      supabase
        .from('listings')
        .select('id, title, host_id')
        .eq('id', request.listing_id)
        .maybeSingle<ListingEmailRow>(),
      request.guest_id
        ? supabase
            .from('profiles')
            .select('full_name')
            .eq('id', request.guest_id)
            .maybeSingle<ProfileEmailRow>()
        : Promise.resolve({ data: null }),
    ])

    if (host?.notify_new_enquiry_email === false) return false
    const hostEmail = await resolveHostEmail(host)
    if (!hostEmail) {
      console.error('Skipping host enquiry email: no host email for request', requestId)
      return false
    }

    const listingTitle = listing?.title || 'your stay'
    const dates = `${request.check_in || 'Date not set'} to ${request.check_out || 'date not set'}`
    const guestName = guest?.full_name || 'A guest'

    return await sendEmail({
      to: hostEmail,
      subject: `New enquiry for ${listingTitle}`,
      html: baseEmailHtml({
        greeting: `Hi ${escapeHtml(host?.name || 'there')},`,
        intro: `${guestName} sent a new enquiry for ${listingTitle}. Dates: ${dates}. Guests: ${request.guests || 1}. Message: ${request.message || 'No message provided.'}`,
        ctaLabel: 'Open host messages',
        ctaUrl: `${siteUrl}/host/dashboard/messages`,
      }),
    })
  } catch (error) {
    console.error('Unable to send host enquiry email', error)
    return false
  }
}

export async function sendHostNewMessageEmail({
  supabase,
  conversationId,
  senderId,
}: {
  supabase: SupabaseClient
  conversationId: string
  senderId: string
}) {
  try {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, listing_id, participant_1, participant_2')
      .eq('id', conversationId)
      .maybeSingle<ConversationEmailRow>()

    if (!conversation || conversation.participant_1 !== senderId) return false

    const [{ data: host }, { data: listing }, { data: guest }, { data: message }] = await Promise.all([
      hostReader(supabase)
        .from('hosts')
        .select('id, user_id, name, email, notify_messages_email')
        .or(`id.eq.${conversation.participant_2},user_id.eq.${conversation.participant_2}`)
        .limit(1)
        .maybeSingle<HostEmailRow & { notify_messages_email?: boolean | null }>(),
      conversation.listing_id
        ? supabase
            .from('listings')
            .select('id, title, host_id')
            .eq('id', conversation.listing_id)
            .maybeSingle<ListingEmailRow>()
        : Promise.resolve({ data: null }),
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', senderId)
        .maybeSingle<ProfileEmailRow>(),
      supabase
        .from('messages')
        .select('content, created_at')
        .eq('conversation_id', conversationId)
        .eq('sender_id', senderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<MessageEmailRow>(),
    ])

    if (host?.notify_messages_email === false) return false
    const hostEmail = await resolveHostEmail(host)
    if (!hostEmail) return false

    const listingTitle = listing?.title || 'your listing'
    const guestName = guest?.full_name || 'A guest'
    const messagePreview = message?.content || 'New message received.'

    return await sendEmail({
      to: hostEmail,
      subject: `New message about ${listingTitle}`,
      html: baseEmailHtml({
        greeting: `Hi ${escapeHtml(host?.name || 'there')},`,
        intro: `${guestName} sent you a new message about ${listingTitle}: ${messagePreview}`,
        ctaLabel: 'Open host messages',
        ctaUrl: `${siteUrl}/host/dashboard/messages?conversation=${conversationId}`,
      }),
    })
  } catch (error) {
    console.error('Unable to send host message email', error)
    return false
  }
}

export async function sendGuestNewMessageEmail({
  supabase,
  conversationId,
  senderId,
}: {
  supabase: SupabaseClient
  conversationId: string
  senderId: string
}) {
  try {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, listing_id, participant_1, participant_2')
      .eq('id', conversationId)
      .maybeSingle<ConversationEmailRow>()

    if (!conversation) {
      console.error('Skipping guest message email: conversation not found')
      return false
    }

    const [{ data: hostCandidates }, { data: listing }, { data: guest }, { data: message }] = await Promise.all([
      hostReader(supabase)
        .from('hosts')
        .select('id, user_id, name, display_name, email, notify_messages_email')
        .or(`id.eq.${conversation.participant_2},user_id.eq.${conversation.participant_2},id.eq.${senderId},user_id.eq.${senderId}`),
      conversation.listing_id
        ? supabase
            .from('listings')
            .select('id, title, host_id')
            .eq('id', conversation.listing_id)
            .maybeSingle<ListingEmailRow>()
        : Promise.resolve({ data: null }),
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', conversation.participant_1)
        .maybeSingle<ProfileEmailRow>(),
      supabase
        .from('messages')
        .select('content, created_at')
        .eq('conversation_id', conversationId)
        .eq('sender_id', senderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<MessageEmailRow>(),
    ])

    const hostRows = hostCandidates || []
    const host =
      hostRows.find((row) => row.id === conversation.participant_2) ||
      hostRows.find((row) => row.user_id === conversation.participant_2) ||
      hostRows.find((row) => row.id === senderId || row.user_id === senderId) ||
      null
    const senderOwnsConversationHost =
      conversation.participant_2 === senderId ||
      hostRows.some((row) => row.id === conversation.participant_2 && row.user_id === senderId) ||
      hostRows.some((row) => row.user_id === conversation.participant_2 && row.id === senderId)

    if (!senderOwnsConversationHost) {
      console.error('Skipping guest message email: sender is not the conversation host')
      return false
    }

    if (host?.notify_messages_email === false) return false

    const guestEmail =
      (await getAuthUserEmail(conversation.participant_1)) ||
      (await getConversationGuestEmail(supabase, conversationId))
    if (!guestEmail) {
      console.error('Skipping guest message email: guest email not found')
      return false
    }

    const hostName = host?.display_name || host?.name || 'The host'
    const guestName = guest?.full_name || 'there'
    const listingTitle = listing?.title || 'your enquiry'
    const messagePreview = message?.content || 'New message received.'

    return await sendEmail({
      to: guestEmail,
      subject: `${hostName} sent you a message`,
      html: baseEmailHtml({
        greeting: `Hi ${escapeHtml(guestName)},`,
        intro: `${hostName} sent you a new message about ${listingTitle}: ${messagePreview}`,
        ctaLabel: 'Open message',
        ctaUrl: `${siteUrl}/account/messages?conversation=${conversationId}`,
      }),
    })
  } catch (error) {
    console.error('Unable to send guest message email', error)
    return false
  }
}

type BookingConfirmListingRow = {
  id: string
  title: string | null
  area: string | null
  check_in_instructions: string | null
  price_usd: number | null
  price_ils: number | null
  deposit_type: string | null
  deposit_value: number | null
  balance_due_days_before_checkin: number | null
  deposit_due_days_before_checkin: number | null
}

type PaymentProfileEmailRow = {
  accepts_direct_payment: boolean | null
  direct_payment_instructions: string | null
  preferred_currency: string | null
  payout_details: unknown
}

function formatEmailDate(iso: string | null): string {
  if (!iso) return 'to be confirmed'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function minusDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

// YYYY-MM-DD from a Date's LOCAL components (computeDepositPreview returns
// local-midnight dates; toISOString would shift a day for UTC+ timezones).
function isoDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function moneyLabel(currency: string, amount: number): string {
  const symbol = currency === 'USD' ? '$' : currency === 'ILS' ? '₪' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : ''
  const formatted = amount.toLocaleString('en-GB', { maximumFractionDigits: 2 })
  return symbol ? `${symbol}${formatted}` : `${formatted} ${currency}`
}

// Sent to the guest when a host confirms their request: property details, dates,
// and the direct-payment plan (deposit + balance due dates, how to pay).
export async function sendGuestBookingConfirmedEmail({
  supabase,
  requestId,
}: {
  supabase: SupabaseClient
  requestId: string
}) {
  try {
    const { data: request } = await supabase
      .from('booking_requests')
      .select('id, listing_id, host_id, guest_id, check_in, check_out, guests, message')
      .eq('id', requestId)
      .maybeSingle<BookingRequestEmailRow>()

    if (!request?.guest_id || !request.listing_id) return false

    const [{ data: listing }, { data: profile }, { data: paymentProfile }] = await Promise.all([
      supabase
        .from('listings')
        .select(
          'id, title, area, check_in_instructions, price_usd, price_ils, deposit_type, deposit_value, balance_due_days_before_checkin, deposit_due_days_before_checkin',
        )
        .eq('id', request.listing_id)
        .maybeSingle<BookingConfirmListingRow>(),
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', request.guest_id)
        .maybeSingle<ProfileEmailRow>(),
      request.host_id
        ? hostReader(supabase)
            .from('host_payment_profiles')
            .select('accepts_direct_payment, direct_payment_instructions, preferred_currency, payout_details')
            .eq('host_id', request.host_id)
            .maybeSingle<PaymentProfileEmailRow>()
        : Promise.resolve({ data: null }),
    ])

    const guestEmail = await getAuthUserEmail(request.guest_id)
    if (!guestEmail) {
      console.error('Skipping booking confirmed email: guest email not found')
      return false
    }

    const guestName = profile?.full_name || 'there'
    const listingTitle = listing?.title || 'your stay'
    const areaSuffix = listing?.area ? ` in ${listing.area}` : ''

    const detailRows: [string, string][] = [
      ['Dates', `${formatEmailDate(request.check_in)} to ${formatEmailDate(request.check_out)}`],
      ['Guests', String(request.guests || 1)],
    ]
    if (listing?.area) detailRows.push(['Area', listing.area])

    let paymentHtml = ''
    if (paymentProfile?.accepts_direct_payment) {
      const payRows: [string, string][] = []

      // The deposit/balance schedule comes from the LISTING (deposit_type/value +
      // due-days) — the same source JLM bookings use — so a booking's terms don't
      // change with the payment route. Total = nights × the listing's nightly rate
      // in its booking currency (USD if priced in USD, else ILS), and the split is
      // computed by computeDepositPreview (mirrors create_pending_booking_payment).
      const nightly =
        listing?.price_usd != null
          ? Number(listing.price_usd)
          : listing?.price_ils != null
            ? Number(listing.price_ils)
            : null
      const currency = listing?.price_usd != null ? 'USD' : 'ILS'
      const nights =
        request.check_in && request.check_out
          ? Math.round(
              (new Date(`${request.check_out}T12:00:00`).getTime() -
                new Date(`${request.check_in}T12:00:00`).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : 0

      if (listing && nightly != null && nights > 0 && request.check_in) {
        const preview = computeDepositPreview({
          bookingTotal: nightly * nights,
          depositType: listing.deposit_type || 'percent',
          depositValue: Number(listing.deposit_value ?? 10),
          balanceDueDaysBeforeCheckin: Number(listing.balance_due_days_before_checkin ?? 0),
          checkIn: new Date(`${request.check_in}T12:00:00`),
        })
        const depositDue =
          listing.deposit_due_days_before_checkin != null
            ? `due by ${formatEmailDate(minusDaysIso(request.check_in, Number(listing.deposit_due_days_before_checkin)))}`
            : 'due to secure your booking'
        payRows.push(['Deposit', `${moneyLabel(currency, preview.depositAmount)} — ${depositDue}`])
        if (preview.balanceAmount > 0) {
          payRows.push([
            'Balance',
            `${moneyLabel(currency, preview.balanceAmount)} — due by ${formatEmailDate(isoDateLocal(preview.balanceDueDate))}`,
          ])
        }
      }

      // Payout account: host-level column first, legacy nested JSON as a fallback.
      const payout = resolveHostPayout(
        paymentProfile.payout_details,
        paymentProfile.direct_payment_instructions,
      )
      const payoutRows = payout ? formatPayoutRows(payout) : []
      const howToPayHtml =
        payoutRows.length > 0
          ? `<p style="margin:14px 0 2px"><strong>How to pay the host</strong></p>${detailTableHtml(payoutRows)}`
          : ''

      if (payRows.length > 0 || howToPayHtml) {
        const scheduleHtml =
          payRows.length > 0
            ? `<h3 style="font-size:15px;margin:20px 0 6px">Payment schedule</h3>${detailTableHtml(payRows)}`
            : ''
        paymentHtml = `${scheduleHtml}${howToPayHtml}`
      }
    }

    const checkInHtml = listing?.check_in_instructions
      ? `<h3 style="font-size:15px;margin:20px 0 6px">Check-in</h3><p style="margin:0;white-space:pre-line">${escapeHtml(listing.check_in_instructions)}</p>`
      : ''

    const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#292524">
      <p>Hi ${escapeHtml(guestName)},</p>
      <p>Great news — your booking at <strong>${escapeHtml(listingTitle)}</strong>${escapeHtml(areaSuffix)} is confirmed.</p>
      ${detailTableHtml(detailRows)}
      ${paymentHtml}
      ${checkInHtml}
      <p style="margin:20px 0 0">
        <a href="${siteUrl}/account/bookings" style="display:inline-block;background:#c76f55;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:700">
          View your trip
        </a>
      </p>
      <p style="margin-top:16px">JLM Collective</p>
      <p style="color:#a8a29e;font-size:11px;margin:8px 0 0;line-height:1.5">
        JLM Collective acts as letting agent for Jerusalem property owners. Bookings are between guests and hosts. JLM Collective is not a party to any booking agreement.
      </p>
    </div>
    `

    return await sendEmail({
      to: guestEmail,
      subject: `Your booking at ${listingTitle} is confirmed`,
      html,
    })
  } catch (error) {
    console.error('Unable to send booking confirmed email', error)
    return false
  }
}

type PaidBookingPaymentRow = {
  id: string
  guest_id: string | null
  booking_id: string | null
  currency: string | null
  balance_amount: number | null
  balance_due_date: string | null
  balance_status: string | null
}

type PaidBookingRow = {
  check_in: string | null
  check_out: string | null
  listings:
    | { title: string | null; area: string | null }
    | { title: string | null; area: string | null }[]
    | null
}

// Sent to the guest when a JLM/Stripe booking finalises (deposit settled + booking
// created). The deposit is already paid, so we acknowledge it and surface the balance
// with a one-click "pay your balance" link. Instant book-now bookings get no other
// confirmation, so this IS their confirmation. Called best-effort from the Stripe
// webhook AFTER the event is recorded, so a Stripe retry (deduped up front) can't
// resend it, and a failure here never blocks finalisation. Every amount comes from
// the settled booking_payments row, never recomputed.
export async function sendGuestPaidBookingConfirmedEmail({
  supabase,
  sessionId,
}: {
  supabase: SupabaseClient
  sessionId: string
}) {
  try {
    const { data: paymentRow } = await supabase
      .from('booking_payments')
      .select('id, guest_id, booking_id, currency, balance_amount, balance_due_date, balance_status')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle<PaidBookingPaymentRow>()

    if (!paymentRow?.guest_id || !paymentRow.booking_id) return false

    const { data: booking } = await supabase
      .from('bookings')
      .select('check_in, check_out, listings(title, area)')
      .eq('id', paymentRow.booking_id)
      .maybeSingle<PaidBookingRow>()

    const guestEmail = await getAuthUserEmail(paymentRow.guest_id)
    if (!guestEmail) {
      console.error('Skipping paid booking confirmed email: guest email not found')
      return false
    }

    const listingRow = oneOrNull(booking?.listings)
    const listingTitle = listingRow?.title || 'your stay'
    const areaSuffix = listingRow?.area ? ` in ${listingRow.area}` : ''
    const currency = String(paymentRow.currency || 'USD').toUpperCase()

    const detailRows: [string, string][] = [
      ['Dates', `${formatEmailDate(booking?.check_in ?? null)} to ${formatEmailDate(booking?.check_out ?? null)}`],
      ['Deposit', 'Paid at booking'],
    ]

    const balanceMajor = Number(paymentRow.balance_amount)
    const hasBalance =
      paymentRow.balance_status === 'due' && Number.isFinite(balanceMajor) && balanceMajor > 0

    let balanceHtml = ''
    if (hasBalance) {
      detailRows.push([
        'Balance',
        `${moneyLabel(currency, balanceMajor)} — due by ${formatEmailDate(paymentRow.balance_due_date)}`,
      ])
      // One-click: signs the guest in and opens the Stripe checkout for this exact
      // booking's balance (falls back to the bookings page if a link can't be made).
      const payUrl = await recipientMagicLink(guestEmail, `/pay-balance/${paymentRow.id}`)
      balanceHtml = `
      <p style="margin:20px 0 0">
        <a href="${payUrl}" style="display:inline-block;background:#c76f55;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:700">
          Pay your balance
        </a>
      </p>`
    } else {
      balanceHtml = `<p style="margin:16px 0 0">Your stay is paid in full — nothing more to pay.</p>`
    }

    const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#292524">
      <p>Hi there,</p>
      <p>Your payment went through and your stay at <strong>${escapeHtml(listingTitle)}</strong>${escapeHtml(areaSuffix)} is confirmed.</p>
      ${detailTableHtml(detailRows)}
      ${balanceHtml}
      <p style="margin:20px 0 0">
        <a href="${siteUrl}/account/bookings" style="display:inline-block;border:1px solid #d6d3d1;color:#292524;text-decoration:none;border-radius:999px;padding:10px 16px;font-weight:600">
          View your trip
        </a>
      </p>
      <p style="margin-top:16px">JLM Collective</p>
      <p style="color:#a8a29e;font-size:11px;margin:8px 0 0;line-height:1.5">
        JLM Collective acts as letting agent for Jerusalem property owners. Bookings are between guests and hosts. JLM Collective is not a party to any booking agreement.
      </p>
    </div>
    `

    return await sendEmail({
      to: guestEmail,
      subject: `Your booking at ${listingTitle} is confirmed`,
      html,
    })
  } catch (error) {
    console.error('Unable to send paid booking confirmed email', error)
    return false
  }
}

// Sent to the host as a record when they confirm a guest's request. Gated on the
// host's "Booking confirmed" notification preference (notify_booking_confirmed_email).
export async function sendHostBookingConfirmedEmail({
  supabase,
  requestId,
}: {
  supabase: SupabaseClient
  requestId: string
}) {
  try {
    const { data: request } = await supabase
      .from('booking_requests')
      .select('id, listing_id, host_id, guest_id, check_in, check_out, guests, message')
      .eq('id', requestId)
      .maybeSingle<BookingRequestEmailRow>()

    if (!request?.host_id || !request.listing_id) return false

    const [{ data: host }, { data: listing }, { data: guest }] = await Promise.all([
      hostReader(supabase)
        .from('hosts')
        .select('id, user_id, name, email, notify_booking_confirmed_email')
        .eq('id', request.host_id)
        .maybeSingle<HostEmailRow>(),
      supabase
        .from('listings')
        .select('id, title, host_id')
        .eq('id', request.listing_id)
        .maybeSingle<ListingEmailRow>(),
      request.guest_id
        ? supabase
            .from('profiles')
            .select('full_name')
            .eq('id', request.guest_id)
            .maybeSingle<ProfileEmailRow>()
        : Promise.resolve({ data: null }),
    ])

    if (host?.notify_booking_confirmed_email === false) return false
    const hostEmail = await resolveHostEmail(host)
    if (!hostEmail) return false

    const listingTitle = listing?.title || 'your stay'
    const guestName = guest?.full_name || 'A guest'
    const dates = `${formatEmailDate(request.check_in)} to ${formatEmailDate(request.check_out)}`

    return await sendEmail({
      to: hostEmail,
      subject: `Booking confirmed — ${guestName} at ${listingTitle}`,
      html: baseEmailHtml({
        greeting: `Hi ${escapeHtml(host?.name || 'there')},`,
        intro: `You confirmed ${escapeHtml(guestName)}'s booking for ${escapeHtml(listingTitle)}. Dates: ${escapeHtml(dates)}. Guests: ${request.guests || 1}. We've emailed the guest their confirmation and payment details.`,
        ctaLabel: 'Open your calendar',
        ctaUrl: `${siteUrl}/host/dashboard/calendar`,
      }),
    })
  } catch (error) {
    console.error('Unable to send host booking confirmed email', error)
    return false
  }
}

function detailTableHtml(rows: [string, string][]) {
  const rowHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#78716c;vertical-align:top;white-space:nowrap">${escapeHtml(
          label,
        )}</td><td style="padding:4px 0;color:#292524">${escapeHtml(value)}</td></tr>`,
    )
    .join('')
  return `<table style="border-collapse:collapse;font-size:14px;margin:8px 0">${rowHtml}</table>`
}

export async function sendPaymentFailureAdminAlert({
  supabase,
  sessionId,
  paymentIntentId,
  listingId,
  guestId,
  checkIn,
  checkOut,
  amount,
  currency,
  failureReason,
}: {
  supabase: SupabaseClient
  sessionId: string
  paymentIntentId: string | null
  listingId: string | null
  guestId: string | null
  checkIn: string | null
  checkOut: string | null
  amount: number | null
  currency: string | null
  failureReason: string
}) {
  try {
    const recipients = await getAdminAlertRecipients(supabase)
    if (recipients.length === 0) {
      console.error(
        '[payment-alert] No admin alert recipient — set ADMIN_ALERT_EMAIL or make sure an owner admin exists',
      )
      return false
    }

    const guestEmail = guestId ? await getAuthUserEmail(guestId) : null
    const amountLabel =
      amount != null ? `${(currency || '').toUpperCase()} ${Number(amount).toFixed(2)}` : 'Unknown'

    const rows: [string, string][] = [
      ['Listing ID', listingId || 'Unknown'],
      ['Guest ID', guestId || 'Unknown'],
      ['Guest email', guestEmail || 'Unknown'],
      ['Dates', `${checkIn || 'Unknown'} to ${checkOut || 'Unknown'}`],
      ['Amount charged', amountLabel],
      ['Stripe session', sessionId],
      ['Payment intent', paymentIntentId || 'Unknown'],
      ['Failure reason', failureReason],
    ]

    const html = paymentAlertHtml(rows)

    const results = await Promise.all(
      recipients.map((to) =>
        sendEmail({
          to,
          subject: 'Action needed: payment received but booking not finalised',
          html,
        }),
      ),
    )
    return results.some(Boolean)
  } catch (error) {
    console.error('Unable to send payment failure admin alert', error)
    return false
  }
}

async function getAdminAlertRecipients(supabase: SupabaseClient): Promise<string[]> {
  const configured = process.env.ADMIN_ALERT_EMAIL
  if (configured) {
    return configured
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  }

  // No env override: fall back to owner admins so alerts still reach someone.
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_admin', true)
    .eq('admin_role', 'owner')
    .limit(5)

  const ids = (data || []).map((row: { id: string }) => row.id)
  const emails = await Promise.all(ids.map((id) => getAuthUserEmail(id)))
  return emails.filter((email): email is string => Boolean(email))
}

function paymentAlertHtml(rows: [string, string][]) {
  const rowHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#78716c;vertical-align:top">${escapeHtml(
          label,
        )}</td><td style="padding:6px 0;color:#292524">${escapeHtml(value)}</td></tr>`,
    )
    .join('')

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#292524">
      <p>A guest was charged, but their booking could not be finalised automatically. This payment needs manual review.</p>
      <table style="border-collapse:collapse;font-size:14px;margin:12px 0">${rowHtml}</table>
      <p>
        <a href="${siteUrl}/admin/payments" style="display:inline-block;background:#c76f55;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:700">
          Open payment control
        </a>
      </p>
      <p style="color:#78716c;font-size:13px">Check whether the booking exists. If not, either finalise it manually or refund the guest in Stripe and record the refund.</p>
      <p>JLM Collective</p>
    </div>
  `
}

const SUPPORT_CASE_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  under_review: 'Under review',
  waiting_on_guest: 'Waiting on the guest',
  waiting_on_host: 'Waiting on the host',
  resolved: 'Resolved',
  closed: 'Closed',
}

type SupportCaseEmailRow = {
  id: string
  guest_id: string | null
  host_id: string | null
  status: string
  resolution_notes: string | null
  approved_refund_amount: number | null
  currency: string | null
  listings?: { title: string | null } | { title: string | null }[] | null
  bookings?: { stripe_checkout_session_id: string | null } | { stripe_checkout_session_id: string | null }[] | null
}

// Notify BOTH the guest and the host when JLM changes a report's status or
// records a resolution. Uses the service role so it can read both parties'
// contact details regardless of who triggered the update.
export async function sendSupportCaseStatusEmail({
  supabase,
  caseId,
}: {
  supabase: SupabaseClient
  caseId: string
}) {
  try {
    const { data: report } = await hostReader(supabase)
      .from('support_cases')
      .select('id, guest_id, host_id, status, resolution_notes, approved_refund_amount, currency, listings(title), bookings(stripe_checkout_session_id)')
      .eq('id', caseId)
      .maybeSingle<SupportCaseEmailRow>()

    if (!report) return

    const listingTitle = oneOrNull(report.listings)?.title || 'your stay'
    const statusLabel = SUPPORT_CASE_STATUS_LABELS[report.status] || report.status
    const paidOnline = Boolean(oneOrNull(report.bookings)?.stripe_checkout_session_id)
    const amount =
      report.approved_refund_amount && report.approved_refund_amount > 0
        ? `${report.currency || ''} ${report.approved_refund_amount.toLocaleString()}`.trim()
        : null

    const lines = [`Your report about ${escapeHtml(listingTitle)} is now marked "${escapeHtml(statusLabel)}".`]
    if (report.resolution_notes) lines.push(`JLM Collective's note: ${escapeHtml(report.resolution_notes)}`)
    if (amount) {
      // Be honest about how money actually moves: online bookings can be
      // refunded through Stripe; direct-payment bookings are settled between the
      // host and guest, so JLM records the decision but does not refund itself.
      lines.push(
        paidOnline
          ? `Approved amount: ${escapeHtml(amount)}. This will be refunded through the original online payment.`
          : `Approved amount: ${escapeHtml(amount)}. This booking was paid directly, so JLM Collective will arrange settlement with the host — it is not refunded automatically.`,
      )
    }
    const intro = lines.join(' ')
    const subject = `Update on your report — ${listingTitle}`

    const guestEmail = report.guest_id ? await getAuthUserEmail(report.guest_id) : null

    let hostEmail: string | null = null
    if (report.host_id) {
      const { data: host } = await hostReader(supabase)
        .from('hosts')
        .select('id, user_id, name, email')
        .eq('id', report.host_id)
        .maybeSingle<HostEmailRow>()
      hostEmail = await resolveHostEmail(host)
    }

    await Promise.all([
      guestEmail
        ? sendEmail({
            to: guestEmail,
            subject,
            html: baseEmailHtml({
              greeting: 'Hi there,',
              intro,
              ctaLabel: 'View your report',
              ctaUrl: `${siteUrl}/account/support`,
            }),
          })
        : Promise.resolve(false),
      hostEmail
        ? sendEmail({
            to: hostEmail,
            subject,
            html: baseEmailHtml({
              greeting: 'Hi there,',
              intro,
              ctaLabel: 'View your report',
              ctaUrl: `${siteUrl}/host/dashboard/cases`,
            }),
          })
        : Promise.resolve(false),
    ])
  } catch (error) {
    console.error('Unable to send support report status email', error)
  }
}

export async function sendGuestBalanceReminderEmail({
  guestId,
  bookingPaymentId,
  listingTitle,
  balanceLabel,
  dueDateLabel,
}: {
  guestId: string
  bookingPaymentId?: string | null
  listingTitle: string
  balanceLabel: string
  dueDateLabel: string
}) {
  const guestEmail = await getAuthUserEmail(guestId)
  if (!guestEmail) {
    console.error('Skipping balance reminder: guest email not found', { guestId })
    return false
  }

  // One-click: the CTA signs the guest in and drops them straight into the Stripe
  // checkout for this booking's balance. If we don't have the payment id, fall back
  // to the bookings page where they can still pay it.
  const ctaPath = bookingPaymentId ? `/pay-balance/${bookingPaymentId}` : '/account/bookings'
  const ctaUrl = await recipientMagicLink(guestEmail, ctaPath)

  return await sendEmail({
    to: guestEmail,
    subject: `Balance due for ${listingTitle}`,
    html: baseEmailHtml({
      greeting: 'Hi there,',
      intro: `The remaining balance of ${balanceLabel} for your stay at ${listingTitle} is due by ${dueDateLabel}. Pay it securely by card using the button below.`,
      ctaUrl,
      ctaLabel: 'Pay your balance',
    }),
  })
}

// Confirmation for a host-entered manual/off-platform booking. The guest has no
// account, so this takes the raw email the host typed and the booking details
// directly (no requestId / guest_id lookup) and sends a plain confirmation.
export async function sendManualBookingGuestEmail({
  to,
  guestName,
  listingTitle,
  area,
  checkIn,
  checkOut,
  guests,
}: {
  to: string
  guestName: string | null
  listingTitle: string
  area: string | null
  checkIn: string
  checkOut: string
  guests: number | null
}) {
  try {
    const areaSuffix = area ? ` in ${area}` : ''
    const detailRows: [string, string][] = [
      ['Dates', `${formatEmailDate(checkIn)} to ${formatEmailDate(checkOut)}`],
      ['Guests', String(guests || 1)],
    ]
    if (area) detailRows.push(['Area', area])

    const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#292524">
      <p>Hi ${escapeHtml(guestName || 'there')},</p>
      <p>Your booking at <strong>${escapeHtml(listingTitle)}</strong>${escapeHtml(areaSuffix)} is confirmed.</p>
      ${detailTableHtml(detailRows)}
      <p style="margin-top:16px">JLM Collective</p>
      <p style="color:#a8a29e;font-size:11px;margin:8px 0 0;line-height:1.5">
        JLM Collective acts as letting agent for Jerusalem property owners. Bookings are between guests and hosts. JLM Collective is not a party to any booking agreement.
      </p>
    </div>
    `

    return await sendEmail({
      to,
      subject: `Your booking at ${listingTitle} is confirmed`,
      html,
    })
  } catch (error) {
    console.error('Unable to send manual booking guest email', error)
    return false
  }
}

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const resendApiKey = process.env.RESEND_API_KEY

  if (!resendApiKey) {
    console.error('[transactional-email] Missing RESEND_API_KEY — email not sent', { to, subject })
    return false
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'JLM Collective <no-reply@jlmcollective.co>',
        to,
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      console.error('[transactional-email] Resend API error — email not sent', {
        to,
        subject,
        status: response.status,
        body,
      })
      return false
    }

    return true
  } catch (error) {
    console.error('[transactional-email] Network error sending email', { to, subject, error })
    return false
  }
}

async function getAuthUserEmail(userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return null
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  })

  if (!response.ok) {
    console.error('Failed to fetch auth user email', await response.text())
    return null
  }

  const user = (await response.json()) as { email?: string | null }
  return user.email || null
}

async function getConversationGuestEmail(supabase: SupabaseClient, conversationId: string) {
  const { data, error } = await supabase
    .from('booking_requests')
    .select('guest_email')
    .eq('conversation_id', conversationId)
    .not('guest_email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<ConversationRequestEmailRow>()

  if (error) {
    console.error('Failed to fetch booking request guest email', error)
  }

  return data?.guest_email || (await getConversationGuestEmailWithServiceRole(conversationId))
}

async function getConversationGuestEmailWithServiceRole(conversationId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return null

  const response = await fetch(
    `${supabaseUrl}/rest/v1/booking_requests?select=guest_email&conversation_id=eq.${conversationId}&guest_email=not.is.null&order=created_at.desc&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  )

  if (!response.ok) {
    console.error('Failed to fetch booking request guest email with service role', await response.text())
    return null
  }

  const rows = (await response.json()) as ConversationRequestEmailRow[]
  return rows[0]?.guest_email || null
}

function baseEmailHtml({
  greeting,
  intro,
  ctaUrl,
  ctaLabel,
  showSignInHint = true,
}: {
  greeting: string
  intro: string
  ctaUrl: string
  ctaLabel: string
  showSignInHint?: boolean
}) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#292524">
      <p>${greeting}</p>
      <p>${escapeHtml(intro)}</p>
      <p>
        <a href="${ctaUrl}" style="display:inline-block;background:#c76f55;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:700">
          ${escapeHtml(ctaLabel)}
        </a>
      </p>
      ${showSignInHint ? '<p style="color:#78716c;font-size:13px">You may need to sign in before viewing the update.</p>' : ''}
      <p>JLM Collective</p>
      <p style="color:#a8a29e;font-size:11px;margin:8px 0 0;line-height:1.5">
        JLM Collective acts as letting agent for Jerusalem property owners. Bookings are between guests and hosts. JLM Collective is not a party to any booking agreement.
      </p>
    </div>
  `
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
