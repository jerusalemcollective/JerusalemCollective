import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  CalendarDays,
  Heart,
  Home,
  LifeBuoy,
  MessageCircle,
  Plus,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { AccountProfileForm } from '@/components/account-profile-form'
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

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-6">
        <header className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-stone-950">Account</h1>
          <p className="mt-2 text-stone-600">Profile, trips, saved stays, messages, and support.</p>
        </header>

        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <AccountMenu hasStay={hasStay} isAdmin={Boolean((profile as Profile | null)?.is_admin)} />
          <AccountProfileForm
            user={{ id: user.id, email: userEmail }}
            profile={(profile as Profile | null) || null}
            hasStay={hasStay}
          />
        </div>
      </div>
    </div>
  )
}

function AccountMenu({ hasStay, isAdmin }: { hasStay: boolean; isAdmin: boolean }) {
  return (
    <nav className="space-y-1">
      <MenuLink href="/account" label="Profile" icon={<UserRound className="h-5 w-5" />} active />
      <MenuLink href="/account/bookings" label="My trips" icon={<CalendarDays className="h-5 w-5" />} />
      <MenuLink href="/account/saved" label="Saved" icon={<Heart className="h-5 w-5" />} />
      <MenuLink href="/account/messages" label="Messages" icon={<MessageCircle className="h-5 w-5" />} />
      <MenuLink href="/account/support" label="Support" icon={<LifeBuoy className="h-5 w-5" />} />

      <div className="pt-4">
        {hasStay ? (
          <MenuLink href="/host/dashboard" label="Host dashboard" icon={<Home className="h-5 w-5" />} accent />
        ) : (
          <MenuLink href="/become-a-host" label="Become a host" icon={<Plus className="h-5 w-5" />} accent />
        )}
        {isAdmin && (
          <MenuLink href="/admin" label="Admin workspace" icon={<ShieldCheck className="h-5 w-5" />} accent />
        )}
      </div>
    </nav>
  )
}

function MenuLink({
  href,
  label,
  icon,
  active = false,
  accent = false,
}: {
  href: string
  label: string
  icon: ReactNode
  active?: boolean
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-4 py-3 font-medium transition ${
        active
          ? 'bg-white text-stone-950 shadow-sm'
          : accent
            ? 'border border-[#c76f55] text-[#c76f55] hover:bg-[#fff4ef]'
            : 'text-stone-600 hover:bg-white hover:text-stone-950 hover:shadow-sm'
      }`}
    >
      {icon}
      {label}
    </Link>
  )
}
