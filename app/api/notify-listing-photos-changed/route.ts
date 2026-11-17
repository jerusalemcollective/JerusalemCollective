import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { alertListingPhotosChanged } from '@/lib/listing-alerts'

// "{host} changed the photos of {listing}" for the JLM team. Called by the
// host's photo manager after a photo is added, removed or reordered. Only for
// the listing's own host and only while it is live; at most one email per
// listing per hour (see lib/listing-alerts.ts). The photo change itself is
// already saved: every failure here is a quiet no-op.

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { listingId?: string }
  const listingId = body.listingId

  if (!listingId || !uuidPattern.test(listingId)) {
    return NextResponse.json({ error: 'Missing listing id.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  try {
    // Same ownership rule as the host dashboard: the hosts row linked to this
    // user, or the user's own id (see lib/host-dashboard.ts).
    const { data: host } = await supabase
      .from('hosts')
      .select('id, name, display_name')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .limit(1)
      .maybeSingle<{ id: string; name: string | null; display_name: string | null }>()
    const hostIds = Array.from(new Set([host?.id, user.id].filter(Boolean))) as string[]

    const { data: listing } = await supabase
      .from('listings')
      .select('id, title, is_published')
      .eq('id', listingId)
      .in('host_id', hostIds)
      .maybeSingle<{ id: string; title: string | null; is_published: boolean | null }>()

    if (!listing) {
      return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
    }
    if (!listing.is_published) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const emailSent = await alertListingPhotosChanged({
      listingId,
      title: listing.title,
      hostName: host?.display_name?.trim() || host?.name?.trim() || null,
    })
    return NextResponse.json({ ok: true, emailSent })
  } catch (error) {
    console.error('Could not send the listing photos alert', listingId, error)
    return NextResponse.json({ ok: true, emailSent: false })
  }
}
