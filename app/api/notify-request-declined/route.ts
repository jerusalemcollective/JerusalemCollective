import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isRequestHost, sendTeamRequestDeclinedEmail } from '@/lib/booking-team-email'

// Team copy when a host declines a request from the Messages inbox. The decline
// itself happens in the browser (update_booking_request_status); the inbox calls
// this once after it succeeds. Only the request's host can trigger it, and the
// helper sends nothing unless the request is actually declined.

type NotifyRequestDeclinedBody = {
  requestId?: string
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as NotifyRequestDeclinedBody
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

  if (!(await isRequestHost(requestId, user.id))) {
    return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
  }

  const emailSent = await sendTeamRequestDeclinedEmail({ requestId })
  return NextResponse.json({ ok: true, emailSent })
}
