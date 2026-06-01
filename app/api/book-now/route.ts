import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type BookNowBody = {
  listingId?: string
  checkIn?: string
  checkOut?: string
  guests?: number
}

type InstantListing = {
  id: string
  title: string
  host_id: string | null
  price_usd: number | null
  price_ils: number | null
  booking_type: string | null
  online_payment_enabled: boolean | null
  is_published: boolean | null
}

function isBookNowBody(value: unknown): value is BookNowBody {
  if (typeof value !== 'object' || value === null) return false
  const body = value as Record<string, unknown>
  return (
    (body.listingId === undefined || typeof body.listingId === 'string') &&
    (body.checkIn === undefined || typeof body.checkIn === 'string') &&
    (body.checkOut === undefined || typeof body.checkOut === 'string') &&
    (body.guests === undefined || typeof body.guests === 'number')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function dateToUtcMs(value: string) {
  return new Date(`${value}T00:00:00.000Z`).getTime()
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
  if (!isBookNowBody(rawBody)) {
    return NextResponse.json({ error: 'Invalid booking request.' }, { status: 400 })
  }

  const listingId = rawBody.listingId || ''
  const checkIn = rawBody.checkIn || ''
  const checkOut = rawBody.checkOut || ''
  const guests = rawBody.guests || 1

  if (!listingId || !checkIn || !checkOut || guests < 1) {
    return NextResponse.json({ error: 'Choose dates before booking.' }, { status: 400 })
  }

  const nights = Math.round((dateToUtcMs(checkOut) - dateToUtcMs(checkIn)) / (1000 * 60 * 60 * 24))
  if (nights < 1) {
    return NextResponse.json({ error: 'Check-out must be after check-in.' }, { status: 400 })
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: 'Online deposit payments are not configured yet.' },
      { status: 503 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Please sign in before booking.' }, { status: 401 })
  }

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, title, host_id, price_usd, price_ils, booking_type, online_payment_enabled, is_published')
    .eq('id', listingId)
    .maybeSingle<InstantListing>()

  if (listingError) {
    return NextResponse.json({ error: listingError.message }, { status: 400 })
  }

  if (!listing || !listing.is_published || !listing.online_payment_enabled) {
    return NextResponse.json({ error: 'This stay is not available for online booking.' }, { status: 400 })
  }

  if (!listing.host_id) {
    return NextResponse.json({ error: 'Host is not available for this listing.' }, { status: 400 })
  }

  const { data: paymentProfile, error: paymentProfileError } = await supabase
    .from('host_payment_profiles')
    .select('accepts_jlm_payment')
    .eq('host_id', listing.host_id)
    .maybeSingle()

  if (paymentProfileError) {
    return NextResponse.json({ error: paymentProfileError.message }, { status: 400 })
  }

  if (!paymentProfile?.accepts_jlm_payment) {
    return NextResponse.json({ error: 'This host has not enabled JLM online payment yet.' }, { status: 400 })
  }

  const { data: blockedRanges, error: blockedError } = await supabase
    .from('listing_unavailable_ranges')
    .select('id')
    .eq('listing_id', listingId)
    .lt('start_date', checkOut)
    .gt('end_date', checkIn)
    .limit(1)

  if (blockedError) {
    return NextResponse.json({ error: blockedError.message }, { status: 400 })
  }

  if ((blockedRanges || []).length > 0) {
    return NextResponse.json({ error: 'These dates are no longer available.' }, { status: 409 })
  }

  const currency = listing.price_usd ? 'usd' : listing.price_ils ? 'ils' : null
  const nightlyPrice = listing.price_usd || listing.price_ils
  if (!currency || !nightlyPrice) {
    return NextResponse.json({ error: 'This stay does not have an online booking price yet.' }, { status: 400 })
  }

  const depositAmount = Math.max(Math.round(nightlyPrice * nights * 0.1 * 100), 50)
  const siteUrl = getSiteUrl(request)
  const checkoutParams = new URLSearchParams()
  checkoutParams.set('mode', 'payment')
  checkoutParams.set('client_reference_id', listingId)
  checkoutParams.set('success_url', `${siteUrl}/account/bookings?payment=success`)
  checkoutParams.set('cancel_url', `${siteUrl}/listings/${listingId}?payment=cancelled`)
  checkoutParams.set('line_items[0][price_data][currency]', currency)
  checkoutParams.set('line_items[0][price_data][product_data][name]', `10% deposit - ${listing.title}`)
  checkoutParams.set('line_items[0][price_data][unit_amount]', String(depositAmount))
  checkoutParams.set('line_items[0][quantity]', '1')
  checkoutParams.set('metadata[listing_id]', listingId)
  checkoutParams.set('metadata[guest_id]', user.id)
  checkoutParams.set('metadata[host_id]', listing.host_id)
  checkoutParams.set('metadata[check_in]', checkIn)
  checkoutParams.set('metadata[check_out]', checkOut)
  checkoutParams.set('metadata[guests]', String(guests))
  checkoutParams.set('payment_intent_data[metadata][listing_id]', listingId)
  checkoutParams.set('payment_intent_data[metadata][guest_id]', user.id)

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: checkoutParams,
  })

  const stripeSession = (await stripeResponse.json().catch(() => ({}))) as unknown

  if (!stripeResponse.ok || !isRecord(stripeSession)) {
    return NextResponse.json({ error: 'Could not start deposit checkout.' }, { status: 502 })
  }

  const checkoutUrl = typeof stripeSession.url === 'string' ? stripeSession.url : null
  const checkoutSessionId = typeof stripeSession.id === 'string' ? stripeSession.id : null

  if (!checkoutUrl || !checkoutSessionId) {
    return NextResponse.json({ error: 'Checkout did not return a payment link.' }, { status: 502 })
  }

  const { error: paymentError } = await supabase.from('booking_payments').insert({
    host_id: listing.host_id,
    guest_id: user.id,
    payment_mode: 'platform_checkout',
    currency: currency.toUpperCase(),
    amount: depositAmount / 100,
    platform_fee_amount: 0,
    processor_fee_amount: 0,
    host_payout_amount: depositAmount / 100,
    host_payout_currency: currency.toUpperCase(),
    fx_rate_used: null,
    status: 'pending',
    payout_status: 'not_ready',
    stripe_checkout_session_id: checkoutSessionId,
  })

  if (paymentError) {
    return NextResponse.json({ error: paymentError.message }, { status: 400 })
  }

  return NextResponse.json({ checkoutUrl })
}
