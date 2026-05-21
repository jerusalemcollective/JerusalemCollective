'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'

const links = [
  { href: '/host/dashboard', label: 'Overview' },
  { href: '/host/dashboard/listings', label: 'Listings' },
  { href: '/host/dashboard/calendar', label: 'Calendar' },
  { href: '/host/dashboard/messages', label: 'Messages' },
  { href: '/host/dashboard/cases', label: 'Cases' },
  { href: '/host/dashboard/payments', label: 'Payments' },
  { href: '/host/dashboard/notifications', label: 'Notifications' },
]

export function HostDashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="mb-8 border-b border-stone-200">
      <div className="flex flex-wrap gap-6">
        {links.map((link) => {
          const isActive =
            link.href === '/host/dashboard'
              ? pathname === link.href
              : pathname.startsWith(link.href)

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`inline-flex items-center gap-1.5 border-b-2 px-0 pb-3 text-sm font-semibold transition ${
                isActive
                  ? 'border-[#c76f55] text-stone-950'
                  : 'border-transparent text-stone-500 hover:text-stone-900'
              }`}
            >
              {link.href === '/host/dashboard/notifications' && <Bell className="h-4 w-4" />}
              {link.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
