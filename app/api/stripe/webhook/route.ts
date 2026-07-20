import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { sendPaymentFailureAdminAlert } from '@/lib/transactional-email'

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

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : null

  if (rpcError) {
    // The money was captured but the booking could not be finalised. Flag the
    // payment for manual review and alert an admin — but only on the FIRST
    // failure (dedup via needs_manual_review = false), so Stripe's retries
    // don't send a fresh alert each time. We still return non-200 so Stripe
    // keeps retrying: a transient failure will self-heal and clear the flag
    // on the success path below.
    const reviewUpdate: Record<string, unknown> = {
      needs_manual_review: true,
      manual_review_reason:
        'Payment succeeded but the booking could not be finalised automatically.',
      failure_reason: rpcError.message,
      admin_alerted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (paymentIntentId) reviewUpdate.stripe_payment_intent_id = paymentIntentId

    const { data: flagged } = await supabase
      .from('booking_payments')
      .update(reviewUpdate)
      .eq('stripe_checkout_session_id', session.id)
      .eq('needs_manual_review', false)
      .select('id, amount, currency')

    if (flagged && flagged.length > 0) {
      const exceptionRow = flagged[0] as { amount: number | null; currency: string | null }
      await sendPaymentFailureAdminAlert({
        supabase,
        sessionId: session.id,
        paymentIntentId,
        listingId: meta.listing_id ?? null,
        guestId: meta.guest_id ?? null,
        checkIn: meta.check_in ?? null,
        checkOut: meta.check_out ?? null,
        amount: exceptionRow.amount,
        currency: exceptionRow.currency,
        failureReason: rpcError.message,
      })
    }

    // Do not record the event, so Stripe's retry reprocesses it.
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  // Success. Clear any manual-review flag left by an earlier failed attempt,
  // and record the payment intent for reconciliation/refunds.
  const successUpdate: Record<string, unknown> = {
    needs_manual_review: false,
    manual_review_reason: null,
    updated_at: new Date().toISOString(),
  }
  if (paymentIntentId) successUpdate.stripe_payment_intent_id = paymentIntentId
  await supabase
    .from('booking_payments')
    .update(successUpdate)
    .eq('stripe_checkout_session_id', session.id)

  // Mark processed only after success.
  if (eventId) {
    await supabase
      .from('processed_stripe_events')
      .insert({ event_id: eventId, type: 'checkout.session.completed' })
  }

  return NextResponse.json({ ok: true })
}
