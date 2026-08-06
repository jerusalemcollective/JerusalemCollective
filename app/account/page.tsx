import { redirect } from 'next/navigation'
import { AccountProfileForm } from '@/components/account-profile-form'
import { WelcomeBanner } from '@/components/welcome-banner'
import { createClient } from '@/lib/supabase/server'

type Profile = {
  id: string
  full_name: string | null
  phone: string | null
  address: string | null
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

  const [{ data: profileBase }, { data: host }, { data: myContact }, { data: myAddress }] = await Promise.all([
    supabase
      .from('profiles')
      // phone and address are no longer readable via a user-scoped table select
      // (migrations 083 and 096); the definers below return the caller's own.
      .select('id, full_name, avatar_url, is_host, is_admin')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('hosts')
      .select('id')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .limit(1)
      .maybeSingle(),
    supabase
      .rpc('get_my_profile_contact')
      .maybeSingle<{ profile_id: string; phone: string | null }>(),
    supabase
      .rpc('get_my_profile_address')
      .maybeSingle<{ profile_id: string; address: string | null }>(),
  ])
  const profile = profileBase
    ? { ...profileBase, phone: myContact?.phone ?? null, address: myAddress?.address ?? null }
    : null

  // host.id may differ from user.id when the host record has its own PK.
  // We query by both to cover direct ownership and delegated host accounts.
  const hostIds = Array.from(new Set([host?.id, user.id].filter(Boolean))) as string[]
  const [{ data: ownedApplication }, { data: ownedListing }, { count: bookingCount }] = await Promise.all([
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
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  const hasStay = Boolean(host || ownedApplication || ownedListing)
  const isNewGuest = (bookingCount || 0) === 0
  const userEmail = user.email || ''
  const typedProfile = profile as Profile | null

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-5 py-6 md:px-6">
        <header className="mb-5 border-b border-stone-200 pb-4">
          <h1 className="font-display text-2xl font-bold tracking-tight text-stone-950">Account</h1>
        </header>

        <div>
          {isNewGuest && <WelcomeBanner />}
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
