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
    console.error('[notify-host-enquiry] no authenticated user for request', requestId)
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
    console.error('[notify-host-enquiry] not allowed', {
      requestId,
      found: Boolean(bookingRequest),
      guestMatches: bookingRequest?.guest_id === user.id,
    })
    return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
  }

  if (bookingRequest.host_notified_at) {
    console.log('[notify-host-enquiry] already notified, skipping', requestId)
    return NextResponse.json({ ok: true, skipped: true })
  }

  const emailSent = await sendHostNewEnquiryEmail({ supabase, requestId })
  console.log('[notify-host-enquiry] send result', { requestId, emailSent })

  if (emailSent) {
    // The only UPDATE policy on booking_requests covers hosts and admins, but
    // the actor here is the guest — a direct update matched zero rows without
    // erroring, so host_notified_at never stuck and this email re-sent every
    // time. This function sets that one column after checking guest ownership.
    const { error: markError } = await supabase.rpc('mark_booking_request_host_notified', {
      request_uuid: requestId,
    })

    if (markError) {
      console.error('Could not record host notification for request', requestId, markError)
    }
  }

  return NextResponse.json({ ok: true, emailSent })
}
