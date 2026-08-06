import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function requireHostDashboardAccess() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/host/dashboard')
  }

  // email is intentionally NOT selected here: after migration 074 the
  // authenticated role can't read hosts.email, and nothing consumes host.email
  // from this guard. A host's own email is available via get_my_host_contact().
  const { data: host } = await supabase
    .from('hosts')
    .select('id, user_id, name, display_name, host_type, is_verified')
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle()

  // host.id may differ from user.id when the host record has its own PK.
  // We query by both to cover direct ownership and delegated host accounts.
  const hostIds = Array.from(new Set([host?.id, user.id].filter(Boolean))) as string[]

  const [{ data: application }, { data: listing }] = await Promise.all([
    supabase
      .from('host_applications')
      .select('id')
      .in('host_id', hostIds)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('listings')
      .select('id')
      .in('host_id', hostIds)
      .limit(1)
      .maybeSingle(),
  ])

  // A hosts row is created for EVERY signup by a DB trigger (see migration 079),
  // so `host` is truthy for essentially everyone and cannot gate access. Require
  // a real host signal — a submitted application or an owned listing — matching
  // the /choose-dashboard eligibility check and the account layout's hasStay.
  if (!application && !listing) {
    redirect('/become-a-host')
  }

  return {
    supabase,
    user,
    host: host || {
      id: user.id,
      user_id: user.id,
      name: user.user_metadata?.full_name || user.email || 'Host',
      display_name: user.user_metadata?.name || null,
      host_type: null,
      is_verified: false,
    },
    hostIds,
  }
}
