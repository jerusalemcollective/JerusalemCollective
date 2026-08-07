import { AdminShell } from '@/components/admin-shell'
import { requireAdmin } from '@/lib/admin'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

// Auth-gated, user-specific data — render per request, never prerender at build.
export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { adminRole } = await requireAdmin()

  return <AdminShell adminRole={adminRole}>{children}</AdminShell>
}
