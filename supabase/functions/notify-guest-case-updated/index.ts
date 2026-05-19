type SupportCaseRecord = {
  guest_id: string | null
  reason: string | null
  status: string | null
}

type WebhookPayload = {
  record?: SupportCaseRecord
  old_record?: SupportCaseRecord
}

type ProfileRow = {
  email?: string | null
}

type AuthUserResponse = {
  email?: string | null
}

const siteUrl = Deno.env.get('SITE_URL') || 'https://www.jlmcollective.co'

Deno.serve(async (request) => {
  try {
    const payload = (await request.json()) as WebhookPayload
    const record = payload.record
    const oldRecord = payload.old_record

    if (!record?.guest_id || record.status === oldRecord?.status) {
      return ok()
    }

    const guestEmail = await getGuestEmail(record.guest_id)

    if (!guestEmail) {
      console.log('Skipping support case email: guest email not found')
      return ok()
    }

    await sendEmail({
      to: guestEmail,
      subject: 'Update on your support case',
      html: `
        <p>There is an update on your JLM Collective support case.</p>
        <p><strong>Reason:</strong> ${escapeHtml(record.reason || 'Support request')}</p>
        <p><strong>New status:</strong> ${escapeHtml((record.status || 'updated').replaceAll('_', ' '))}</p>
        <p><a href="${siteUrl}/account/support">Open support</a></p>
      `,
    })
  } catch (error) {
    console.error('notify-guest-case-updated failed', error)
  }

  return ok()
})

async function getGuestEmail(guestId: string) {
  const profile = await fetchSingle<ProfileRow>('profiles', `id=eq.${guestId}&select=email`)
  if (profile?.email) return profile.email

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) return null

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${guestId}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  })

  if (!response.ok) {
    console.error('Failed to fetch auth user email', await response.text())
    return null
  }

  const user = (await response.json()) as AuthUserResponse
  return user.email || null
}

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

function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
