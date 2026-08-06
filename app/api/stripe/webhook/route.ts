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

const HANDLED_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
])

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
  if (!isRecord(event) || typeof event.type !== 'string' || !HANDLED_EVENT_TYPES.has(event.type)) {
    return NextResponse.json({ ok: true })
  }
  const eventType = event.type
  const eventId = typeof event.id === 'string' ? event.id : null

  const data = getNestedRecord(event, 'data')
  const session = data ? getNestedRecord(data, 'object') : null
  if (!session || typeof session.id !== 'string') {
    return NextResponse.json({ error: 'Missing checkout session.' }, { status: 400 })
  }
  const sessionId = session.id

  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey)

  // Idempotency: a replayed/retried event (same event_id) is a no-op. event_id
  // is unique PER EVENT, so the distinct lifecycle events for one session
  // (completed / async_payment_succeeded / async_payment_failed / expired) each
  // process on their own id — this only dedupes true redeliveries of one event.
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

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : null

  const recordEvent = async () => {
    if (eventId) {
      await supabase
        .from('processed_stripe_events')
        .insert({ event_id: eventId, type: eventType })
    }
  }

  // Shared escalation for every post-settlement failure: money captured but the
  // booking could not be finalised. Flag for manual review + alert an admin ONCE
  // (dedup via needs_manual_review=false). Callers return 500 without recording,
  // so Stripe retries; a transient failure self-heals and the success path
  // clears the flag. Factored so the paid-but-unfinalisable metadata cases can
  // reuse it instead of dropping money.
  const escalateManualReview = async (
    reason: string,
    failureReason: string,
    alertMeta: {
      listingId: string | null
      guestId: string | null
      checkIn: string | null
      checkOut: string | null
    },
  ) => {
    const reviewUpdate: Record<string, unknown> = {
      needs_manual_review: true,
      manual_review_reason: reason,
      failure_reason: failureReason,
      admin_alerted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (paymentIntentId) reviewUpdate.stripe_payment_intent_id = paymentIntentId

    const { data: flagged } = await supabase
      .from('booking_payments')
      .update(reviewUpdate)
      .eq('stripe_checkout_session_id', sessionId)
      .eq('needs_manual_review', false)
      .select('id, amount, currency')

    if (flagged && flagged.length > 0) {
      const exceptionRow = flagged[0] as { amount: number | null; currency: string | null }
      await sendPaymentFailureAdminAlert({
        supabase,
        sessionId,
        paymentIntentId,
        listingId: alertMeta.listingId,
        guestId: alertMeta.guestId,
        checkIn: alertMeta.checkIn,
        checkOut: alertMeta.checkOut,
        amount: exceptionRow.amount,
        currency: exceptionRow.currency,
        failureReason,
      })
    }
  }

  // --- Balance payment for an EXISTING booking (guest paid the remainder). ---
  // Balance sessions carry metadata.payment_kind='balance' and are settled by
  // mark_balance_paid, not the booking-finalise path.
  const sessionMetadata = getNestedRecord(session, 'metadata') ?? {}
  if (sessionMetadata.payment_kind === 'balance') {
    const balanceStatus =
      typeof session.payment_status === 'string' ? session.payment_status : null
    const balanceSettled = balanceStatus === 'paid' || balanceStatus === 'no_payment_required'
    if (
      balanceSettled &&
      (eventType === 'checkout.session.completed' ||
        eventType === 'checkout.session.async_payment_succeeded')
    ) {
      const { error } = await supabase.rpc('mark_balance_paid', { p_session_id: sessionId })
      if (error) {
        // Settled money we could not record — let Stripe retry. mark_balance_paid
        // is idempotent (acts only while balance_status='due'), so retry is safe.
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      await recordEvent()
      return NextResponse.json({ ok: true, balance: 'paid' })
    }
    // Unsettled / failed / expired balance session: the balance stays 'due' so
    // the guest can try again. Nothing to finalise; acknowledge.
    await recordEvent()
    return NextResponse.json({ ok: true, balance: 'unsettled' })
  }

  // --- Async charge rejected: no money settled, no booking exists. -----------
  if (eventType === 'checkout.session.async_payment_failed') {
    const { error } = await supabase
      .from('booking_payments')
      .update({
        status: 'failed',
        failure_reason: 'Stripe reported checkout.session.async_payment_failed.',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_checkout_session_id', sessionId)
      .neq('status', 'paid') // never clobber an already-finalised payment
    if (error) {
      // Don't record — otherwise the "charge failed" signal is lost forever.
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    await recordEvent()
    return NextResponse.json({ ok: true, status: 'async_payment_failed' })
  }

  // --- Guest abandoned checkout: close the still-pending payment row. ---------
  if (eventType === 'checkout.session.expired') {
    const { error } = await supabase
      .from('booking_payments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('stripe_checkout_session_id', sessionId)
      .eq('status', 'pending') // only close rows that never advanced
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    await recordEvent()
    return NextResponse.json({ ok: true, status: 'expired' })
  }

  // --- completed / async_payment_succeeded: finalise ONLY on settled money. ---
  const paymentStatus =
    typeof session.payment_status === 'string' ? session.payment_status : null
  const isSettled = paymentStatus === 'paid' || paymentStatus === 'no_payment_required'

  if (!isSettled) {
    // A completed checkout whose async payment has not settled (payment_status
    // 'unpaid' | 'processing'). Do NOT finalise — wait for the async event. Mark
    // 'processing' for visibility, guarded so a finalised row never moves back.
    const { error } = await supabase
      .from('booking_payments')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('stripe_checkout_session_id', sessionId)
      .eq('status', 'pending')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    await recordEvent()
    return NextResponse.json({ ok: true, pending: true })
  }

  // Money has settled. Validate metadata before any finalise mutation.
  const parsedMetadata = metadataSchema.safeParse(getNestedRecord(session, 'metadata') ?? {})
  if (!parsedMetadata.success) {
    console.error('[stripe webhook] invalid session metadata', parsedMetadata.error.flatten())
    // Settled money we cannot attribute: escalate rather than drop it.
    await escalateManualReview(
      'Payment settled but the checkout metadata was invalid, so the booking could not be finalised automatically.',
      'Invalid session metadata.',
      { listingId: null, guestId: null, checkIn: null, checkOut: null },
    )
    return NextResponse.json({ error: 'Invalid session metadata.' }, { status: 500 })
  }
  const meta = parsedMetadata.data

  let rpcError: { message: string } | null = null

  if (meta.booking_request_id) {
    const { error } = await supabase.rpc('finalize_paid_booking_request', {
      request_uuid: meta.booking_request_id,
      checkout_session_id: sessionId,
    })
    rpcError = error
  } else {
    if (!meta.listing_id || !meta.guest_id || !meta.host_id || !meta.check_in || !meta.check_out) {
      console.error('[stripe webhook] incomplete instant-booking metadata', meta)
      await escalateManualReview(
        'Payment settled but the instant-booking metadata was incomplete, so the booking could not be finalised automatically.',
        'Incomplete instant-booking metadata.',
        {
          listingId: meta.listing_id ?? null,
          guestId: meta.guest_id ?? null,
          checkIn: meta.check_in ?? null,
          checkOut: meta.check_out ?? null,
        },
      )
      return NextResponse.json({ error: 'Incomplete booking metadata.' }, { status: 500 })
    }
    const { error } = await supabase.rpc('finalize_instant_booking', {
      listing_uuid: meta.listing_id,
      guest_uuid: meta.guest_id,
      host_uuid: meta.host_id,
      check_in_date: meta.check_in,
      check_out_date: meta.check_out,
      guest_count: meta.guests ?? 1,
      checkout_session_id: sessionId,
    })
    rpcError = error
  }

  if (rpcError) {
    await escalateManualReview(
      'Payment succeeded but the booking could not be finalised automatically.',
      rpcError.message,
      {
        listingId: meta.listing_id ?? null,
        guestId: meta.guest_id ?? null,
        checkIn: meta.check_in ?? null,
        checkOut: meta.check_out ?? null,
      },
    )
    // Do not record the event, so Stripe's retry reprocesses it (finalise is
    // idempotent per migration 076, so the retry is safe).
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  // Success. Clear any manual-review flag left by an earlier failed attempt and
  // record the payment intent for reconciliation/refunds.
  const successUpdate: Record<string, unknown> = {
    needs_manual_review: false,
    manual_review_reason: null,
    updated_at: new Date().toISOString(),
  }
  if (paymentIntentId) successUpdate.stripe_payment_intent_id = paymentIntentId
  const { error: successError } = await supabase
    .from('booking_payments')
    .update(successUpdate)
    .eq('stripe_checkout_session_id', sessionId)
  if (successError) {
    // Booking IS finalised, but the flag-clear / PI-store failed. Don't record —
    // let Stripe retry; re-finalise is idempotent (076), so this heals.
    return NextResponse.json({ error: successError.message }, { status: 500 })
  }

  await recordEvent() // mark processed only after a successful finalise
  return NextResponse.json({ ok: true })
}
