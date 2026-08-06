import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardChooser } from '@/components/dashboard-chooser'

export const metadata = {
  title: 'Choose your dashboard | JLM Collective',
}

export default async function ChooseDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/choose-dashboard')
  }

  // A hosts row is created for EVERY signup by a DB trigger, so its existence is
  // NOT a reliable "is a host" signal (see migration 079). We treat someone as a
  // host only once they have a submitted application or an owned listing. We look
  // up the hosts row purely to cover accounts whose host records are keyed by a
  // separate host id rather than the auth user id.
  const { data: host } = await supabase
    .from('hosts')
    .select('id, user_id, name, display_name')
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle()

  const hostIds = Array.from(new Set([host?.id, user.id].filter(Boolean))) as string[]

  const [{ data: application }, { data: listing }, { data: profile }] = await Promise.all([
    supabase.from('host_applications').select('id').in('host_id', hostIds).limit(1).maybeSingle(),
    supabase.from('listings').select('id').in('host_id', hostIds).limit(1).maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ])

  const isHost = Boolean(application || listing)

  // Not a host yet (never submitted an application): the chooser is meaningless.
  // Send them straight to the guest account — a normal login, no extra screen.
  if (!isHost) {
    redirect('/account')
  }

  const displayName =
    host?.display_name ||
    (profile?.full_name ? String(profile.full_name).split(' ')[0] : null) ||
    host?.name ||
    null

  return <DashboardChooser displayName={displayName} />
}
