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

  const data = getNestedRecord(event, 'data')
  const session = data ? getNestedRecord(data, 'object') : null
  if (!session || typeof session.id !== 'string') {
    return NextResponse.json({ error: 'Missing checkout session.' }, { status: 400 })
  }

  const metadata = getNestedRecord(session, 'metadata')
  const requestId =
    metadata && typeof metadata.booking_request_id === 'string'
      ? metadata.booking_request_id
      : null

  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey)
  const listingId =
    metadata && typeof metadata.listing_id === 'string' ? metadata.listing_id : null
  const guestId =
    metadata && typeof metadata.guest_id === 'string' ? metadata.guest_id : null
  const hostId =
    metadata && typeof metadata.host_id === 'string' ? metadata.host_id : null
  const checkIn =
    metadata && typeof metadata.check_in === 'string' ? metadata.check_in : null
  const checkOut =
    metadata && typeof metadata.check_out === 'string' ? metadata.check_out : null
  const guests =
    metadata && typeof metadata.guests === 'string' ? Number(metadata.guests) : 1

  const { error } = requestId
    ? await supabase.rpc('finalize_paid_booking_request', {
        request_uuid: requestId,
        checkout_session_id: session.id,
      })
    : await supabase.rpc('finalize_instant_booking', {
        listing_uuid: listingId,
        guest_uuid: guestId,
        host_uuid: hostId,
        check_in_date: checkIn,
        check_out_date: checkOut,
        guest_count: Number.isFinite(guests) ? guests : 1,
        checkout_session_id: session.id,
      })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
