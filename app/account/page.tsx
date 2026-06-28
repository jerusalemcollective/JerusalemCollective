import { redirect } from 'next/navigation'
import { AccountProfileForm } from '@/components/account-profile-form'
import { AccountMenu } from '@/components/account-menu'
import { WelcomeBanner } from '@/components/welcome-banner'
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

  const [{ data: profile }, { data: host }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, phone, avatar_url, is_host, is_admin')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('hosts')
      .select('id')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .limit(1)
      .maybeSingle(),
  ])

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
          <p className="mt-1.5 text-sm text-stone-600">Profile, trips, saved stays, messages, and support.</p>
        </header>

        <div className="grid gap-5 md:grid-cols-[240px_1fr]">
          <AccountMenu hasStay={hasStay} isAdmin={Boolean(typedProfile?.is_admin)} />
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
    </div>
  )
}
