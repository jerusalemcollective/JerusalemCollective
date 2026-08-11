import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AccountProfileForm } from '@/components/account-profile-form'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

// Auth-gated, user-specific data — render per request, never prerender at build.
export const dynamic = 'force-dynamic'

type Profile = {
  id: string
  full_name: string | null
  phone: string | null
  address: string | null
  avatar_url: string | null
  is_host: boolean | null
  is_admin: boolean | null
  preferred_currency: string | null
}

// Top-level identity page — deliberately NOT under /account so it carries no
// guest-dashboard sidebar. Linked from the global header on both guest and host
// pages, since a profile spans both roles.
export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/profile')
  }

  const [{ data: profileBase }, { data: host }, { data: myContact }, { data: myAddress }] = await Promise.all([
    supabase
      .from('profiles')
      // phone and address are no longer readable via a user-scoped table select
      // (migrations 083 and 096); the definers below return the caller's own.
      .select('id, full_name, avatar_url, is_host, is_admin, preferred_currency')
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
  const hostIds = Array.from(new Set([host?.id, user.id].filter(Boolean))) as string[]
  const [{ data: ownedApplication }, { data: ownedListing }] = await Promise.all([
    supabase.from('host_applications').select('id').in('host_id', hostIds).limit(1).maybeSingle(),
    supabase.from('listings').select('id').in('host_id', hostIds).limit(1).maybeSingle(),
  ])

  // A `hosts` row exists for EVERY user (signup trigger), so it is NOT a reliable
  // "is a host" signal — see migration 079. Match the /account and /choose-dashboard
  // definition: a submitted application or an owned listing.
  const hasStay = Boolean(ownedApplication || ownedListing)
  const userEmail = user.email || ''
  const typedProfile = profile as Profile | null

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-5 py-6 md:px-6">
        <header className="mb-5 border-b border-stone-200 pb-4">
          <h1 className="font-display text-3xl font-bold tracking-tight text-stone-950">Profile</h1>
        </header>

        <AccountProfileForm
          user={{ id: user.id, email: userEmail }}
          profile={typedProfile}
          hasStay={hasStay}
        />
      </div>
    </div>
  )
}
