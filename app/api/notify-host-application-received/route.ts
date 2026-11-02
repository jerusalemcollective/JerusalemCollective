import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { sendHostApplicationReceivedEmail } from '@/lib/transactional-email'

// "We've received your listing" — called by /become-a-host after a successful
// submit. The submit never waits on this; every failure is a quiet no-op.
//
// Sent at most once per application: host_applications.received_email_sent_at
// (migration 122) is claimed atomically before sending. Until 122 has been run
// that column is missing, so we fall back to only sending for an application
// created in the last few minutes.

type NotifyHostApplicationReceivedBody = {
  applicationId?: string
}

type ApplicationRow = {
  id: string
  host_id: string | null
  apartment_title: string | null
  display_name: string | null
  host_name: string | null
  email: string | null
  created_at: string | null
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fallbackWindowMs = 15 * 60 * 1000

function isMissingColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    (error.message || '').includes('received_email_sent_at')
  )
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as NotifyHostApplicationReceivedBody
  const applicationId = body.applicationId

  if (!applicationId || !uuidPattern.test(applicationId)) {
    return NextResponse.json({ error: 'Missing application id.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin: SupabaseClient | null = url && key ? createServiceRoleClient(url, key) : null
    const reader = admin || supabase

    const { data: application } = await reader
      .from('host_applications')
      .select('id, host_id, apartment_title, display_name, host_name, email, created_at')
      .eq('id', applicationId)
      .maybeSingle<ApplicationRow>()

    if (!application?.host_id) {
      return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
    }

    // Owner: host_id is the user's id, or a hosts row linked to this user
    // (split-identity hosts, see migration 077).
    let owns = application.host_id === user.id
    if (!owns) {
      const { data: host } = await reader
        .from('hosts')
        .select('id')
        .eq('id', application.host_id)
        .eq('user_id', user.id)
        .maybeSingle<{ id: string }>()
      owns = Boolean(host)
    }
    if (!owns) {
      return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
    }

    const to = user.email || application.email
    if (!to) {
      return NextResponse.json({ ok: true, emailSent: false })
    }

    // Claim the send before sending, so two calls can't both send.
    let claimed = false
    let useFallback = !admin
    if (admin) {
      const { data: claimRows, error: claimError } = await admin
        .from('host_applications')
        .update({ received_email_sent_at: new Date().toISOString() })
        .eq('id', applicationId)
        .is('received_email_sent_at', null)
        .select('id')

      if (claimError) {
        if (!isMissingColumn(claimError)) throw claimError
        console.warn('[notify-host-application-received] Run migration 122 to record sent emails.')
        useFallback = true
      } else if (!claimRows || claimRows.length === 0) {
        return NextResponse.json({ ok: true, skipped: true })
      } else {
        claimed = true
      }
    }

    if (useFallback) {
      const createdAt = application.created_at ? new Date(application.created_at).getTime() : NaN
      if (Number.isNaN(createdAt) || Date.now() - createdAt > fallbackWindowMs) {
        return NextResponse.json({ ok: true, skipped: true })
      }
    }

    const emailSent = await sendHostApplicationReceivedEmail({
      to,
      name: application.display_name || application.host_name,
      title: application.apartment_title,
    })

    if (!emailSent && claimed && admin) {
      // Let a later call try again.
      await admin
        .from('host_applications')
        .update({ received_email_sent_at: null })
        .eq('id', applicationId)
    }

    return NextResponse.json({ ok: true, emailSent })
  } catch (error) {
    console.error('Could not send the application received email', applicationId, error)
    return NextResponse.json({ ok: true, emailSent: false })
  }
}
