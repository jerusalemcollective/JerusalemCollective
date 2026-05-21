type BookingRequestRecord = {
  id: string
  listing_id: string | null
  host_id: string | null
  guest_id: string | null
  check_in: string | null
  check_out: string | null
  guests: number | null
  message: string | null
}

type WebhookPayload = {
  record?: BookingRequestRecord
}

type HostRow = {
  email?: string | null
  notify_new_enquiry_email?: boolean | null
}

type ListingRow = {
  title?: string | null
}

type ProfileRow = {
  full_name?: string | null
}

const siteUrl = Deno.env.get('SITE_URL') || 'https://www.jlmcollective.co'

Deno.serve(async (request) => {
  try {
    const payload = (await request.json()) as WebhookPayload
    const record = payload.record

    if (!record?.host_id || !record.listing_id) {
      console.log('Skipping host enquiry email: missing host_id or listing_id')
      return ok()
    }

    const [host, listing, guest] = await Promise.all([
      fetchSingle<HostRow>('hosts', `id=eq.${record.host_id}&select=email,notify_new_enquiry_email`),
      fetchSingle<ListingRow>('listings', `id=eq.${record.listing_id}&select=title`),
      record.guest_id
        ? fetchSingle<ProfileRow>('profiles', `id=eq.${record.guest_id}&select=full_name`)
        : Promise.resolve(null),
    ])

    if (!host?.email) {
      console.log('Skipping host enquiry email: host email not found')
      return ok()
    }

    if (host.notify_new_enquiry_email === false) {
      return ok({ ok: true, skipped: true })
    }

    const listingTitle = listing?.title || 'your stay'
    const guestName = guest?.full_name || 'A guest'
    const dates = `${record.check_in || 'Date not set'} to ${record.check_out || 'date not set'}`
    const guests = record.guests || 1

    await sendEmail({
      to: host.email,
      subject: `New enquiry for ${listingTitle}`,
      html: `
        <p>${escapeHtml(guestName)} sent a new enquiry for <strong>${escapeHtml(listingTitle)}</strong>.</p>
        <p><strong>Dates:</strong> ${escapeHtml(dates)}</p>
        <p><strong>Guests:</strong> ${guests}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(record.message || 'No message provided.')}</p>
        <p><a href="${siteUrl}/host/dashboard/messages">Open host messages</a></p>
      `,
    })
  } catch (error) {
    console.error('notify-host-new-enquiry failed', error)
  }

  return ok()
})

async function fetchSingle<T>(table: string, query: string): Promise<T | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return null
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}&limit=1`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  })

  if (!response.ok) {
    console.error(`Failed to fetch ${table}`, await response.text())
    return null
  }

  const rows = (await response.json()) as T[]
  return rows[0] || null
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
  const resendApiKey = Deno.env.get('RESEND_API_KEY')

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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function ok(body: Record<string, unknown> = { ok: true }) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  })
}
