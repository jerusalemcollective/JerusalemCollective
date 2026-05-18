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

  const { data: host } = await supabase
    .from('hosts')
    .select('id, user_id, name, display_name, email, host_type, is_verified')
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle()

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

  if (!host && !application && !listing) {
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
      email: user.email || null,
      host_type: null,
      is_verified: false,
    },
    hostIds,
  }
}
