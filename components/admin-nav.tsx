'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { canAdminRole, type AdminPermission, type AdminRole } from '@/lib/admin-permissions'

const adminLinks = [
  { href: '/admin', label: 'Overview', permission: 'overview' },
  { href: '/admin/applications', label: 'Applications', permission: 'applications' },
  { href: '/admin/enquiries', label: 'Enquiries', permission: 'messages' },
  { href: '/admin/listings', label: 'Listings', permission: 'listings' },
  { href: '/admin/analytics', label: 'Analytics', permission: 'analytics' },
  { href: '/admin/cases', label: 'Disputes & refunds', permission: 'cases' },
  { href: '/admin/guests', label: 'Guests', permission: 'guests' },
  { href: '/admin/hosts', label: 'Hosts', permission: 'hosts' },
  { href: '/admin/reviews', label: 'Reviews', permission: 'reviews' },
  { href: '/admin/admins', label: 'Admins', permission: 'admins' },
] satisfies { href: string; label: string; permission: AdminPermission }[]

export function AdminNav({ adminRole }: { adminRole: AdminRole }) {
  const pathname = usePathname()
  const visibleLinks = adminLinks.filter((link) => canAdminRole(adminRole, link.permission))

  return (
    <nav className="space-y-1">
      {visibleLinks.map((link) => {
        const isActive =
          link.href === '/admin' ? pathname === link.href : pathname.startsWith(link.href)

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`block rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              isActive
                ? 'bg-stone-950 text-white'
                : 'text-stone-600 hover:bg-white hover:text-stone-950'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
