import type { SupabaseClient } from '@supabase/supabase-js'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.jlmcollective.co'

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
    const { data: host } = await supabase
      .from('hosts')
      .select('id, name, email')
      .eq('id', hostId)
      .maybeSingle<HostEmailRow>()

    if (!host?.email) return

    await sendEmail({
      to: host.email,
      subject,
      html: baseEmailHtml({
        greeting: `Hi ${escapeHtml(host.name || 'there')},`,
        intro,
        ctaLabel,
        ctaUrl: `${siteUrl}${ctaPath}`,
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
    const { data: listing } = await supabase
      .from('listings')
      .select('id, title, host_id, hosts(name, email)')
      .eq('id', listingId)
      .maybeSingle<ListingEmailRow>()

    const email = listing?.hosts?.email
    if (!email) return

    await sendEmail({
      to: email,
      subject,
      html: baseEmailHtml({
        greeting: `Hi ${escapeHtml(listing.hosts?.name || 'there')},`,
        intro,
        ctaLabel,
        ctaUrl: `${siteUrl}${ctaPath}`,
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
      supabase
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
      supabase
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
      supabase
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
}: {
  greeting: string
  intro: string
  ctaUrl: string
  ctaLabel: string
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
      <p style="color:#78716c;font-size:13px">You may need to sign in before viewing the update.</p>
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
