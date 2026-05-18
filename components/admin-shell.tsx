import { AdminNav } from '@/components/admin-nav'
import type { AdminRole } from '@/lib/admin-permissions'

export function AdminShell({
  adminRole,
  children,
}: {
  adminRole: AdminRole
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-8 text-[#252525] md:px-6">
      <section className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[210px_1fr]">
        <aside className="h-fit lg:sticky lg:top-8">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Admin</p>
            <h1 className="mt-2 text-2xl font-bold text-stone-950">Workspace</h1>
          </div>
          <AdminNav adminRole={adminRole} />
        </aside>

        <div className="min-w-0">{children}</div>
      </section>
    </main>
  )
}
