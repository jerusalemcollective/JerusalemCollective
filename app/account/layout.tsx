import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AccountMenu } from '@/components/account-menu'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/account')
  }

  const [{ data: profile }, { data: host }] = await Promise.all([
    supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(),
    supabase
      .from('hosts')
      .select('id')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .limit(1)
      .maybeSingle(),
  ])

  // host.id may differ from user.id when the host record has its own PK.
  const hostIds = Array.from(new Set([host?.id, user.id].filter(Boolean))) as string[]
  const [{ data: ownedApplication }, { data: ownedListing }] = await Promise.all([
    supabase.from('host_applications').select('id').in('host_id', hostIds).limit(1).maybeSingle(),
    supabase.from('listings').select('id').in('host_id', hostIds).limit(1).maybeSingle(),
  ])

  const hasStay = Boolean(host || ownedApplication || ownedListing)
  const isAdmin = Boolean((profile as { is_admin?: boolean | null } | null)?.is_admin)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <div className="md:sticky md:top-6 md:self-start">
          <AccountMenu hasStay={hasStay} isAdmin={isAdmin} />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
