import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendGuestNewMessageEmail } from '@/lib/transactional-email'

type NotifyGuestMessageBody = {
  conversationId?: string
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as NotifyGuestMessageBody
  const conversationId = body.conversationId

  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversation id.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const emailSent = await sendGuestNewMessageEmail({
    supabase,
    conversationId,
    senderId: user.id,
  })

  return NextResponse.json({ ok: true, emailSent })
}
