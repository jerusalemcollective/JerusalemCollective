import { AdminShell } from '@/components/admin-shell'
import { requireAdmin } from '@/lib/admin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()

  return <AdminShell>{children}</AdminShell>
}
