import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

export const runtime = 'nodejs'

// Stripe metadata values are always strings. Unknown keys are ignored.
const metadataSchema = z.object({
  booking_request_id: z.string().uuid().optional(),
  listing_id: z.string().uuid().optional(),
  guest_id: z.string().uuid().optional(),
  host_id: z.string().uuid().optional(),
  check_in: z.string().min(1).optional(),
  check_out: z.string().min(1).optional(),
  guests: z.coerce.number().int().positive().optional(),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getNestedRecord(value: Record<string, unknown>, key: string) {
  const nested = value[key]
  return isRecord(nested) ? nested : null
}

function verifyStripeSignature(payload: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(',').map((part) => part.trim())
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2)
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3))

  if (!timestamp || signatures.length === 0) return false

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')

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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
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
  if (!isRecord(event) || event.type !== 'checkout.session.completed') {
    return NextResponse.json({ ok: true })
  }

  const eventId = typeof event.id === 'string' ? event.id : null

  const data = getNestedRecord(event, 'data')
  const session = data ? getNestedRecord(data, 'object') : null
  if (!session || typeof session.id !== 'string') {
    return NextResponse.json({ error: 'Missing checkout session.' }, { status: 400 })
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey)

  // Idempotency: a replayed or retried event must be a no-op so we never create
  // duplicate bookings/charges.
  if (eventId) {
    const { data: seen } = await supabase
      .from('processed_stripe_events')
      .select('event_id')
      .eq('event_id', eventId)
      .maybeSingle()
    if (seen) {
      return NextResponse.json({ ok: true, duplicate: true })
    }
  }

  // Validate metadata shape before any database mutation.
  const parsedMetadata = metadataSchema.safeParse(getNestedRecord(session, 'metadata') ?? {})
  if (!parsedMetadata.success) {
    console.error('[stripe webhook] invalid session metadata', parsedMetadata.error.flatten())
    return NextResponse.json({ error: 'Invalid session metadata.' }, { status: 400 })
  }
  const meta = parsedMetadata.data

  let rpcError: { message: string } | null = null

  if (meta.booking_request_id) {
    const { error } = await supabase.rpc('finalize_paid_booking_request', {
      request_uuid: meta.booking_request_id,
      checkout_session_id: session.id,
    })
    rpcError = error
  } else {
    if (!meta.listing_id || !meta.guest_id || !meta.host_id || !meta.check_in || !meta.check_out) {
      console.error('[stripe webhook] incomplete instant-booking metadata', meta)
      return NextResponse.json({ error: 'Incomplete booking metadata.' }, { status: 400 })
    }
    const { error } = await supabase.rpc('finalize_instant_booking', {
      listing_uuid: meta.listing_id,
      guest_uuid: meta.guest_id,
      host_uuid: meta.host_id,
      check_in_date: meta.check_in,
      check_out_date: meta.check_out,
      guest_count: meta.guests ?? 1,
      checkout_session_id: session.id,
    })
    rpcError = error
  }

  if (rpcError) {
    // Do not record the event, so Stripe's retry reprocesses it.
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  // Mark processed only after success.
  if (eventId) {
    await supabase
      .from('processed_stripe_events')
      .insert({ event_id: eventId, type: 'checkout.session.completed' })
  }

  return NextResponse.json({ ok: true })
}
