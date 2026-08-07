import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendGuestBookingConfirmedEmail } from '@/lib/transactional-email'

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

  const emailSent = await sendGuestBookingConfirmedEmail({ supabase, requestId })

  return NextResponse.json({ ok: true, emailSent })
}
