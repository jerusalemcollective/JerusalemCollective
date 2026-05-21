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

type ProfileEmailRow = {
  full_name: string | null
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

    if (!request?.host_id || !request.listing_id) return

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

    if (!host?.email) return
    if (host.notify_new_enquiry_email === false) return

    const listingTitle = listing?.title || 'your stay'
    const dates = `${request.check_in || 'Date not set'} to ${request.check_out || 'date not set'}`
    const guestName = guest?.full_name || 'A guest'

    await sendEmail({
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
    console.error('Missing RESEND_API_KEY')
    return
  }

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
    console.error('Resend email failed', await response.text())
  }
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
