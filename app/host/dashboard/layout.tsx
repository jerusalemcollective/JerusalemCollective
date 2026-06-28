import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

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

  return children
}
