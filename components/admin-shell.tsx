import Link from 'next/link'

const adminLinks = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/applications', label: 'Applications' },
  { href: '/admin/listings', label: 'Listings' },
  { href: '/admin/cases', label: 'Disputes & refunds' },
  { href: '/admin/hosts', label: 'Hosts' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/admins', label: 'Admins' },
]

export function AdminShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-3xl bg-white p-4 shadow-sm">
          <div className="px-2 pb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Admin</p>
            <h1 className="mt-2 text-xl font-bold text-stone-950">Control centre</h1>
          </div>
          <nav className="space-y-1">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-2xl px-3 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 hover:text-stone-950"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div>{children}</div>
      </section>
    </main>
  )
}
