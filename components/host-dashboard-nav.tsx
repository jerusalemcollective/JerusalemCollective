import Link from 'next/link'

const links = [
  { href: '/host/dashboard', label: 'Overview' },
  { href: '/host/dashboard/listings', label: 'Listings' },
  { href: '/host/dashboard/messages', label: 'Messages' },
  { href: '/host/dashboard/cases', label: 'Cases' },
  { href: '/host/dashboard/payments', label: 'Payments' },
]

export function HostDashboardNav() {
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-[#c76f55] hover:text-[#c76f55]"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
