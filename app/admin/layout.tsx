import { AdminShell } from '@/components/admin-shell'
import { requireAdmin } from '@/lib/admin'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { adminRole } = await requireAdmin()

  return <AdminShell adminRole={adminRole}>{children}</AdminShell>
}
