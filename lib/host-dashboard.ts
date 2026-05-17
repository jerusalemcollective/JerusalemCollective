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

  const [{ data: application }, { data: listing }] = await Promise.all([
    supabase
      .from('host_applications')
      .select('id')
      .eq('host_id', user.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('listings')
      .select('id')
      .eq('host_id', user.id)
      .limit(1)
      .maybeSingle(),
  ])

  if (!application && !listing) {
    redirect('/become-a-host')
  }

  return { supabase, user }
}
