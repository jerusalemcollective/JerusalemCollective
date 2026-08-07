import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HostDashboardNav } from '@/components/host-dashboard-nav'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

// Auth-gated, user-specific data — render per request, never prerender at build.
export const dynamic = 'force-dynamic'

// Defense-in-depth: enforce authentication for the whole /host/dashboard segment
// so a future page that forgets requireHostDashboardAccess() still can't render
// for a signed-out visitor. Host-specific resolution stays in each page's call.
export default async function HostDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/host/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#F8F5F2] text-[#252525]">
      <div className="mx-auto grid max-w-[96rem] gap-6 px-4 py-6 md:grid-cols-[240px_1fr] md:px-6">
        <div className="md:sticky md:top-6 md:self-start">
          <HostDashboardNav />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
