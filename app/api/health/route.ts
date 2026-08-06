import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// A real readiness probe: an uptime monitor pointed here now goes red when the
// database is unreachable (or the anon key is revoked) — the failures that stop
// all bookings — instead of always reporting healthy.
export const dynamic = 'force-dynamic'

export async function GET() {
  const checked_at = new Date().toISOString()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, service: 'jlmcollective', db: 'not_configured', checked_at },
      { status: 503 },
    )
  }

  try {
    const supabase = createClient(url, key)
    // Cheap, always-present, anon-readable table (platform_settings is read by
    // the public client already). Head+count avoids transferring any rows.
    const { error } = await supabase
      .from('platform_settings')
      .select('key', { count: 'exact', head: true })
    if (error) {
      return NextResponse.json(
        { ok: false, service: 'jlmcollective', db: 'error', detail: error.message, checked_at },
        { status: 503 },
      )
    }
    return NextResponse.json({ ok: true, service: 'jlmcollective', db: 'ok', checked_at })
  } catch (err) {
    return NextResponse.json(
      { ok: false, service: 'jlmcollective', db: 'unreachable', detail: String(err), checked_at },
      { status: 503 },
    )
  }
}
