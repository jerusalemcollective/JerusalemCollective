import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendGuestBookingConfirmedEmail, sendHostBookingConfirmedEmail } from '@/lib/transactional-email'

type NotifyGuestConfirmationBody = {
  requestId?: string
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as NotifyGuestConfirmationBody
  const requestId = body.requestId

  if (!requestId) {
    return NextResponse.json({ error: 'Missing request id.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  // Confirm the guest; the host receipt is best-effort and gated on their
  // "Booking confirmed" notification preference, so run it alongside.
  const [emailSent] = await Promise.all([
    sendGuestBookingConfirmedEmail({ supabase, requestId }),
    sendHostBookingConfirmedEmail({ supabase, requestId }),
  ])

  return NextResponse.json({ ok: true, emailSent })
}
