import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendHostNewEnquiryEmail } from '@/lib/transactional-email'

type NotifyHostEnquiryBody = {
  requestId?: string
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as NotifyHostEnquiryBody
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

  const { data: bookingRequest } = await supabase
    .from('booking_requests')
    .select('id, guest_id, host_notified_at')
    .eq('id', requestId)
    .maybeSingle<{
      id: string
      guest_id: string | null
      host_notified_at: string | null
    }>()

  if (!bookingRequest || bookingRequest.guest_id !== user.id) {
    return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
  }

  if (bookingRequest.host_notified_at) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const emailSent = await sendHostNewEnquiryEmail({ supabase, requestId })

  if (emailSent) {
    await supabase
      .from('booking_requests')
      .update({ host_notified_at: new Date().toISOString() })
      .eq('id', requestId)
  }

  return NextResponse.json({ ok: true, emailSent })
}
