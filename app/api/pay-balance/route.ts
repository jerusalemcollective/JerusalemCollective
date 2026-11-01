import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startBalanceCheckout, getSiteUrl } from '@/lib/balance-checkout'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null)
  const bookingPaymentId =
    isRecord(rawBody) && typeof rawBody.bookingPaymentId === 'string' ? rawBody.bookingPaymentId : ''

  if (!bookingPaymentId) {
    return NextResponse.json({ error: 'We couldn’t tell which booking to pay for. Please refresh the page and try again.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Please sign in to pay your balance.' }, { status: 401 })
  }

  const result = await startBalanceCheckout(supabase, bookingPaymentId, user.id, getSiteUrl(request))
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ checkoutUrl: result.checkoutUrl })
}
