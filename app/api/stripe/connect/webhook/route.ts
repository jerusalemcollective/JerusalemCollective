import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getNestedRecord(value: Record<string, unknown>, key: string) {
  const nested = value[key]
  return isRecord(nested) ? nested : null
}

// Identical scheme to app/api/stripe/webhook/route.ts.
function verifyStripeSignature(payload: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(',').map((part) => part.trim())
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2)
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3))
  if (!timestamp || signatures.length === 0) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  return signatures.some((signature) => {
    const expectedBuffer = Buffer.from(expected, 'hex')
    const signatureBuffer = Buffer.from(signature, 'hex')
    return (
      expectedBuffer.length === signatureBuffer.length &&
      timingSafeEqual(expectedBuffer, signatureBuffer)
    )
  })
}

export async function POST(request: Request) {
  // SEPARATE signing secret: this endpoint is its own Stripe webhook (Connect
  // events on connected accounts) with a different whsec_ than the checkout hook.
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 500 })
  }

  const payload = await request.text()
  const signatureHeader = request.headers.get('stripe-signature')
  if (!signatureHeader || !verifyStripeSignature(payload, signatureHeader, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  const event = JSON.parse(payload) as unknown
  if (!isRecord(event) || typeof event.type !== 'string') {
    return NextResponse.json({ ok: true })
  }
  if (event.type !== 'account.updated') {
    // Phase 1 handles only account.updated. Ack the rest so Stripe stops retrying.
    return NextResponse.json({ ok: true, ignored: event.type })
  }
  const eventId = typeof event.id === 'string' ? event.id : null

  const data = getNestedRecord(event, 'data')
  const account = data ? getNestedRecord(data, 'object') : null
  if (!account || typeof account.id !== 'string') {
    return NextResponse.json({ error: 'Missing account.' }, { status: 400 })
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey)

  // Idempotency: shared ledger with the checkout webhook. A redelivered id no-ops.
  if (eventId) {
    const { data: seen } = await supabase
      .from('processed_stripe_events')
      .select('event_id')
      .eq('event_id', eventId)
      .maybeSingle()
    if (seen) return NextResponse.json({ ok: true, duplicate: true })
  }

  const chargesEnabled = account.charges_enabled === true
  const payoutsEnabled = account.payouts_enabled === true
  const detailsSubmitted = account.details_submitted === true
  const requirements = getNestedRecord(account, 'requirements')
  const disabledReason =
    requirements && typeof requirements.disabled_reason === 'string'
      ? requirements.disabled_reason
      : null

  // Only values allowed by host_payment_profiles.payout_setup_status CHECK.
  let status: 'not_started' | 'pending' | 'ready' | 'restricted' = 'pending'
  if (payoutsEnabled && chargesEnabled) status = 'ready'
  else if (detailsSubmitted && disabledReason) status = 'restricted'

  // Map to exactly one host by the unique stripe_account_id. No row => an account
  // we don't track; ack without touching anything.
  const { error: updateError } = await supabase
    .from('host_payment_profiles')
    .update({
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_details_submitted: detailsSubmitted,
      payout_setup_status: status,
      stripe_connect_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_account_id', account.id)
  if (updateError) {
    // Transient DB error: do NOT record, let Stripe retry.
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  if (eventId) {
    await supabase.from('processed_stripe_events').insert({ event_id: eventId, type: event.type })
  }
  return NextResponse.json({ ok: true })
}
