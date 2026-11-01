import type { SupabaseClient } from '@supabase/supabase-js'
import { getPaymentRouteSettings } from '@/lib/platform-settings'
import { oneOrNull } from '@/lib/utils/one-or-null'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function getSiteUrl(request: Request) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ||
    new URL(request.url).origin
  )
}

type BalanceCheckoutResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string; status: number }

// Starts a Stripe checkout for a booking's remaining balance. Every monetary value
// comes from the booking_payments row (never the caller); RLS + the guest_id match
// authorize it. Shared by the POST /api/pay-balance endpoint (returns JSON) and the
// GET /pay-balance/[id] one-click email deep-link (redirects straight to checkout).
export async function startBalanceCheckout(
  supabase: SupabaseClient,
  bookingPaymentId: string,
  userId: string,
  siteUrl: string,
): Promise<BalanceCheckoutResult> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) return { ok: false, error: 'Online payment isn’t available yet. Please email info@jlmcollective.co and we’ll help you pay.', status: 503 }

  const paymentRoutes = await getPaymentRouteSettings()
  if (!paymentRoutes.jlmPaymentsEnabled) {
    return { ok: false, error: 'Online payment isn’t available right now. Please try again later.', status: 503 }
  }

  // Guests can only read their own booking_payments (RLS), so this both fetches and
  // authorizes. Every monetary value comes from the row, never the caller.
  const { data: payment } = await supabase
    .from('booking_payments')
    .select('id, currency, balance_amount, balance_status, booking_id, status')
    .eq('id', bookingPaymentId)
    .eq('guest_id', userId)
    .maybeSingle<{
      id: string
      currency: string | null
      balance_amount: number | null
      balance_status: string | null
      booking_id: string | null
      status: string | null
    }>()

  if (!payment) return { ok: false, error: 'We couldn’t find this booking. Please check you’re signed in to the right account.', status: 404 }

  const balanceMajor = Number(payment.balance_amount)
  if (payment.balance_status !== 'due' || !Number.isFinite(balanceMajor) || balanceMajor <= 0) {
    return { ok: false, error: 'There’s nothing left to pay on this booking.', status: 400 }
  }

  // The balance is only payable after the deposit has settled and the booking is
  // confirmed (finalize sets status='paid' + booking_id).
  if (payment.status !== 'paid' || !payment.booking_id) {
    return { ok: false, error: 'This booking isn’t ready for the balance payment yet. Please try again later.', status: 400 }
  }

  const currency = String(payment.currency || '').toLowerCase()
  if (!currency) return { ok: false, error: 'We couldn’t work out the payment for this booking. Please email info@jlmcollective.co and we’ll sort it out.', status: 400 }

  const { data: booking } = await supabase
    .from('bookings')
    .select('status, listings(title)')
    .eq('id', payment.booking_id)
    .maybeSingle<{ status: string | null; listings: { title: string } | { title: string }[] | null }>()

  if (booking?.status === 'cancelled' || booking?.status === 'completed') {
    return { ok: false, error: 'This booking was cancelled, so there’s nothing to pay.', status: 400 }
  }

  let listingTitle = 'your stay'
  const bookingTitle = oneOrNull(booking?.listings)?.title
  if (typeof bookingTitle === 'string' && bookingTitle.trim()) listingTitle = bookingTitle

  const balanceAmount = Math.round(balanceMajor * 100)
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
  params.set('metadata[guest_id]', userId)
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
    return { ok: false, error: 'Something went wrong on our side and we couldn’t open the payment page. Please try again in a moment.', status: 502 }
  }

  const checkoutUrl = typeof stripeSession.url === 'string' ? stripeSession.url : null
  const checkoutSessionId = typeof stripeSession.id === 'string' ? stripeSession.id : null
  if (!checkoutUrl || !checkoutSessionId) {
    return { ok: false, error: 'Something went wrong on our side and we couldn’t open the payment page. Please try again in a moment.', status: 502 }
  }

  const { error: attachError } = await supabase.rpc('attach_balance_checkout_session', {
    payment_uuid: payment.id,
    checkout_session_id: checkoutSessionId,
  })

  if (attachError) {
    console.error('[balance-checkout] could not attach checkout session', attachError)
    return { ok: false, error: 'Something went wrong on our side and we couldn’t open the payment page. Please try again in a moment.', status: 400 }
  }

  return { ok: true, checkoutUrl }
}
