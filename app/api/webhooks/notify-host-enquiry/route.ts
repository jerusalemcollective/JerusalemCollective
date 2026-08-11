import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { sendHostNewEnquiryEmail } from '@/lib/transactional-email'

// Server-side host-enquiry notification, fired by a Supabase Database Webhook on
// INSERT into booking_requests. Unlike the guest-browser path (/api/notify-host-
// enquiry), this runs with the service role and no user session, so it can never
// fail the "caller must be the guest" check — the enquiry email sends reliably
// regardless of which account (if any) the browser is signed into.
//
// Auth: the webhook must send `x-webhook-secret: <SUPABASE_WEBHOOK_SECRET>`. The
// email only ever goes to the listing's host, but the secret keeps randoms from
// triggering sends.

type WebhookPayload = {
  type?: string
  table?: string
  record?: { id?: string; host_notified_at?: string | null } | null
}

export async function POST(request: Request) {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET
  if (!secret || request.headers.get('x-webhook-secret') !== secret) {
    console.error('[webhook/notify-host-enquiry] bad or missing webhook secret')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('[webhook/notify-host-enquiry] missing Supabase service env')
    return NextResponse.json({ error: 'Server not configured.' }, { status: 500 })
  }

  let payload: WebhookPayload
  try {
    payload = (await request.json()) as WebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const requestId = payload.record?.id
  if (!requestId) {
    return NextResponse.json({ error: 'Missing record id.' }, { status: 400 })
  }

  const supabase = createServiceRoleClient(url, key)

  // Dedup: if the guest-browser path (or a webhook retry) already notified, stop.
  const { data: existing } = await supabase
    .from('booking_requests')
    .select('host_notified_at')
    .eq('id', requestId)
    .maybeSingle<{ host_notified_at: string | null }>()

  if (existing?.host_notified_at) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const emailSent = await sendHostNewEnquiryEmail({ supabase, requestId })
  console.log('[webhook/notify-host-enquiry] send result', { requestId, emailSent })

  if (emailSent) {
    const { error: markError } = await supabase
      .from('booking_requests')
      .update({ host_notified_at: new Date().toISOString() })
      .eq('id', requestId)
    if (markError) {
      console.error('[webhook/notify-host-enquiry] could not mark host_notified_at', requestId, markError)
    }
  }

  return NextResponse.json({ ok: true, emailSent })
}
