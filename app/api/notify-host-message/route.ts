import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendHostNewMessageEmail } from '@/lib/transactional-email'

type NotifyHostMessageBody = {
  conversationId?: string
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as NotifyHostMessageBody
  const conversationId = body.conversationId

  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversation id.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.error('[notify-host-message] no authenticated user for conversation', conversationId)
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const emailSent = await sendHostNewMessageEmail({
    supabase,
    conversationId,
    senderId: user.id,
  })
  console.log('[notify-host-message] send result', { conversationId, emailSent })

  return NextResponse.json({ ok: true, emailSent })
}
