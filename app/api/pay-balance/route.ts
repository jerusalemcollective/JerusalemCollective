import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPaymentRouteSettings } from '@/lib/platform-settings'
import { oneOrNull } from '@/lib/utils/one-or-null'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getSiteUrl(request: Request) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ||
    new URL(request.url).origin
  )
}

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null)
  const bookingPaymentId =
    isRecord(rawBody) && typeof rawBody.bookingPaymentId === 'string' ? rawBody.bookingPaymentId : ''

  if (!bookingPaymentId) {
    return NextResponse.json({ error: 'Missing booking.' }, { status: 400 })
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Online payments are not configured yet.' }, { status: 503 })
  }

  const paymentRoutes = await getPaymentRouteSettings()
  if (!paymentRoutes.jlmPaymentsEnabled) {
    return NextResponse.json({ error: 'Online payments are not available right now.' }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  }

  // Guests can only read their own booking_payments (RLS), so this both fetches
  // and authorizes. Every monetary value comes from the row, never the client.
  const { data: payment } = await supabase
    .from('booking_payments')
    .select('id, currency, balance_amount, balance_status, booking_id, status')
    .eq('id', bookingPaymentId)
    .eq('guest_id', user.id)
    .maybeSingle<{
      id: string
      currency: string | null
      balance_amount: number | null
      balance_status: string | null
      booking_id: string | null
      status: string | null
    }>()

  if (!payment) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
  }

  const balanceMajor = Number(payment.balance_amount)
  if (payment.balance_status !== 'due' || !Number.isFinite(balanceMajor) || balanceMajor <= 0) {
    return NextResponse.json({ error: 'There is no balance due on this booking.' }, { status: 400 })
  }

  // The balance is only payable after the deposit has settled and the booking is
  // confirmed (finalize sets status='paid' + booking_id).
  if (payment.status !== 'paid' || !payment.booking_id) {
    return NextResponse.json({ error: 'This booking is not ready for a balance payment yet.' }, { status: 400 })
  }

  const currency = String(payment.currency || '').toLowerCase()
  if (!currency) {
    return NextResponse.json({ error: 'This booking has no payment currency.' }, { status: 400 })
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('status, listings(title)')
    .eq('id', payment.booking_id)
    .maybeSingle<{ status: string | null; listings: { title: string } | { title: string }[] | null }>()

  if (booking?.status === 'cancelled' || booking?.status === 'completed') {
    return NextResponse.json({ error: 'This booking is cancelled, so no balance is due.' }, { status: 400 })
  }

  let listingTitle = 'your stay'
  const listings = booking?.listings
  const bookingTitle = oneOrNull(listings)?.title
  if (typeof bookingTitle === 'string' && bookingTitle.trim()) {
    listingTitle = bookingTitle
  }

  const balanceAmount = Math.round(balanceMajor * 100)
  const siteUrl = getSiteUrl(request)
  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('payment_method_types[0]', 'card')
  params.set('success_url', `${siteUrl}/account/bookings?payment=balance_success`)
  params.set('cancel_url', `${siteUrl}/account/bookings?payment=balance_cancelled`)
  params.set('line_items[0][price_data][currency]', currency)
  params.set('line_items[0][price_data][product_data][name]', `Balance - ${listingTitle}`)
  params.set('line_items[0][price_data][unit_amount]', String(balanceAmount))
  params.set('line_items[0][quantity]', '1')
  params.set('metadata[payment_kind]', 'balance')
  params.set('metadata[booking_payment_id]', payment.id)
  params.set('metadata[guest_id]', user.id)
  params.set('payment_intent_data[metadata][payment_kind]', 'balance')
  params.set('payment_intent_data[metadata][booking_payment_id]', payment.id)

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  const stripeSession = (await stripeResponse.json().catch(() => ({}))) as unknown
  if (!stripeResponse.ok || !isRecord(stripeSession)) {
    return NextResponse.json({ error: 'Could not start the balance payment.' }, { status: 502 })
  }

  const checkoutUrl = typeof stripeSession.url === 'string' ? stripeSession.url : null
  const checkoutSessionId = typeof stripeSession.id === 'string' ? stripeSession.id : null
  if (!checkoutUrl || !checkoutSessionId) {
    return NextResponse.json({ error: 'Checkout did not return a payment link.' }, { status: 502 })
  }

  const { error: attachError } = await supabase.rpc('attach_balance_checkout_session', {
    payment_uuid: payment.id,
    checkout_session_id: checkoutSessionId,
  })

  if (attachError) {
    return NextResponse.json({ error: attachError.message }, { status: 400 })
  }

  return NextResponse.json({ checkoutUrl })
}
