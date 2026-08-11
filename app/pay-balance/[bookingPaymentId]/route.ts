import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startBalanceCheckout, getSiteUrl } from '@/lib/balance-checkout'

// One-click "pay your balance" deep link for emails. The guest arrives already signed
// in (the email CTA is a magic-link), we start the Stripe checkout for that booking's
// balance and redirect straight into it. Any problem falls back to the bookings page,
// where the same balance can still be paid manually.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookingPaymentId: string }> },
) {
  const { bookingPaymentId } = await params
  const siteUrl = getSiteUrl(request)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      `${siteUrl}/login?redirect=${encodeURIComponent(`/pay-balance/${bookingPaymentId}`)}`,
    )
  }

  const result = await startBalanceCheckout(supabase, bookingPaymentId, user.id, siteUrl)
  if (!result.ok) {
    return NextResponse.redirect(`${siteUrl}/account/bookings?payment=balance_error`)
  }

  return NextResponse.redirect(result.checkoutUrl)
}
