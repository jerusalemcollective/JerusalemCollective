import { redirect } from 'next/navigation'
import { AccountProfileForm } from '@/components/account-profile-form'
import { AccountMenu } from '@/components/account-menu'
import { createClient } from '@/lib/supabase/server'

type Profile = {
  id: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  is_host: boolean | null
  is_admin: boolean | null
}

export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/account')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, phone, avatar_url, is_host, is_admin')
    .eq('id', user.id)
    .maybeSingle()

  const { data: host } = await supabase
    .from('hosts')
    .select('id')
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle()

  // host.id may differ from user.id when the host record has its own PK.
  // We query by both to cover direct ownership and delegated host accounts.
  const hostIds = Array.from(new Set([host?.id, user.id].filter(Boolean))) as string[]
  const [{ data: ownedApplication }, { data: ownedListing }] = await Promise.all([
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

  const hasStay = Boolean(ownedApplication || ownedListing)
  const userEmail = user.email || ''
  const typedProfile = profile as Profile | null

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-6">
        <header className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-stone-950">Account</h1>
          <p className="mt-2 text-stone-600">Profile, trips, saved stays, messages, and support.</p>
        </header>

        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <AccountMenu hasStay={hasStay} isAdmin={Boolean(typedProfile?.is_admin)} />
          <AccountProfileForm
            user={{ id: user.id, email: userEmail }}
            profile={typedProfile}
            hasStay={hasStay}
          />
        </div>
      </div>
    </div>
  )
}
