import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendGuestBookingConfirmedEmail, sendHostBookingConfirmedEmail } from '@/lib/transactional-email'
import { isRequestHost, sendTeamBookingConfirmedEmail } from '@/lib/booking-team-email'

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
    // Team copy goes out alongside the guest/host emails, once per host accept
    // (the inbox calls this route once after a successful accept). Only for the
    // request's own host, and the helper skips requests that aren't accepted.
    sendTeamCopy(requestId, user.id),
  ])

  return NextResponse.json({ ok: true, emailSent })
}

async function sendTeamCopy(requestId: string, userId: string) {
  try {
    if (!(await isRequestHost(requestId, userId))) return false
    return await sendTeamBookingConfirmedEmail({ requestId, how: 'accepted' })
  } catch (error) {
    console.error('Unable to send team booking confirmed copy', error)
    return false
  }
}
