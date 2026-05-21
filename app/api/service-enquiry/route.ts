import { NextResponse } from 'next/server'

type ServiceEnquiryBody = Record<string, unknown> & {
  serviceType?: unknown
  name?: unknown
  email?: unknown
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ServiceEnquiryBody
  const serviceType = typeof body.serviceType === 'string' ? body.serviceType : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''

  if (!['catering', 'cleaning'].includes(serviceType)) {
    return NextResponse.json({ error: 'Invalid service type.' }, { status: 400 })
  }

  if (!name || !email.includes('@')) {
    return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    console.warn('RESEND_API_KEY is not set. Service enquiry email was not sent.', body)
    return NextResponse.json({ ok: true })
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'JLM Collective <no-reply@jlmcollective.co>',
        to: ['info@jlmcollective.co'],
        reply_to: email,
        subject: `New ${serviceType} enquiry from ${name}`,
        html: buildEmailHtml(body, serviceType, name, email),
      }),
    })

    if (!response.ok) {
      console.error('Service enquiry email failed', await response.text())
    }
  } catch (error) {
    console.error('Service enquiry email failed', error)
  }

  return NextResponse.json({ ok: true })
}

function buildEmailHtml(
  body: ServiceEnquiryBody,
  serviceType: string,
  name: string,
  email: string,
) {
  const rows = Object.entries(body)
    .filter(([key]) => !['serviceType', 'name', 'email'].includes(key))
    .map(([key, value]) => `<p><strong>${escapeHtml(formatKey(key))}:</strong> ${escapeHtml(String(value || ''))}</p>`)
    .join('')

  return `
    <h2>New ${escapeHtml(serviceType)} enquiry</h2>
    <p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
    ${rows}
  `
}

function formatKey(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
