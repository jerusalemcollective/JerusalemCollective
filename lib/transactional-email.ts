import { createClient as createServiceRoleClient, type SupabaseClient } from '@supabase/supabase-js'

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
    const admin = createServiceRoleClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
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
  name: string | null
  email: string | null
  notify_new_enquiry_email?: boolean | null
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
        greeting: `Hi ${escapeHtml(host.name || 'there')},`,
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
        .select('id, name, email, notify_new_enquiry_email')
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

    if (!host?.email) return false
    if (host.notify_new_enquiry_email === false) return false

    const listingTitle = listing?.title || 'your stay'
    const dates = `${request.check_in || 'Date not set'} to ${request.check_out || 'date not set'}`
    const guestName = guest?.full_name || 'A guest'

    return await sendEmail({
      to: host.email,
      subject: `New enquiry for ${listingTitle}`,
      html: baseEmailHtml({
        greeting: `Hi ${escapeHtml(host.name || 'there')},`,
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
        .select('id, name, email, notify_messages_email')
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

    if (!host?.email) return false
    if (host.notify_messages_email === false) return false

    const listingTitle = listing?.title || 'your listing'
    const guestName = guest?.full_name || 'A guest'
    const messagePreview = message?.content || 'New message received.'

    return await sendEmail({
      to: host.email,
      subject: `New message about ${listingTitle}`,
      html: baseEmailHtml({
        greeting: `Hi ${escapeHtml(host.name || 'there')},`,
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

export async function sendGuestBalanceReminderEmail({
  guestId,
  listingTitle,
  balanceLabel,
  dueDateLabel,
}: {
  guestId: string
  listingTitle: string
  balanceLabel: string
  dueDateLabel: string
}) {
  const guestEmail = await getAuthUserEmail(guestId)
  if (!guestEmail) {
    console.error('Skipping balance reminder: guest email not found', { guestId })
    return false
  }

  return await sendEmail({
    to: guestEmail,
    subject: `Balance due for ${listingTitle}`,
    html: baseEmailHtml({
      greeting: 'Hi there,',
      intro: `The remaining balance of ${balanceLabel} for your stay at ${listingTitle} is due by ${dueDateLabel}. You can pay it securely through the site from your trips.`,
      ctaUrl: `${siteUrl}/account/bookings`,
      ctaLabel: 'Pay your balance',
    }),
  })
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
