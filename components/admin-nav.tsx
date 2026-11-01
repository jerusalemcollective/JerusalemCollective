'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { canAdminRole, type AdminPermission, type AdminRole } from '@/lib/admin-permissions'

const adminLinks = [
  { href: '/admin', label: 'Overview', permission: 'overview' },
  { href: '/admin/applications', label: 'Applications', permission: 'applications' },
  { href: '/admin/listings', label: 'Listings', permission: 'listings' },
  { href: '/admin/bookings', label: 'Bookings', permission: 'guests' },
  { href: '/admin/enquiries', label: 'Enquiries', permission: 'messages' },
  { href: '/admin/reviews', label: 'Reviews', permission: 'reviews' },
  { href: '/admin/cases', label: 'Disputes & refunds', permission: 'cases' },
  { href: '/admin/users', label: 'Users', permission: 'users' },
  { href: '/admin/admins', label: 'Admins', permission: 'admins' },
  { href: '/admin/audit', label: 'Audit log', permission: 'admins' },
] satisfies { href: string; label: string; permission: AdminPermission }[]

export function AdminNav({ adminRole }: { adminRole: AdminRole }) {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)
  const [fade, setFade] = useState({ left: false, right: false })
  const visibleLinks = adminLinks.filter((link) => canAdminRole(adminRole, link.permission))
  const ownerLinks = adminRole === 'owner'
    ? [
        { href: '/admin/payments', label: 'Payments' },
        { href: '/admin/settings', label: 'Settings' },
      ]
    : []

  // Show a fade on whichever edge still has menu items hidden past it.
  const updateFade = useCallback(() => {
    const nav = navRef.current
    if (!nav) return
    const maxScroll = nav.scrollWidth - nav.clientWidth
    setFade({ left: nav.scrollLeft > 4, right: nav.scrollLeft < maxScroll - 4 })
  }, [])

  // On phones the menu scrolls sideways: bring the current page's item into view.
  // Scrolls only the menu itself, never the page.
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]')
    if (active && nav.scrollWidth > nav.clientWidth) {
      const target = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2
      nav.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
    }
    updateFade()
  }, [pathname, updateFade])

  useEffect(() => {
    window.addEventListener('resize', updateFade)
    return () => window.removeEventListener('resize', updateFade)
  }, [updateFade])

  return (
    <div className="relative">
      <nav
        ref={navRef}
        onScroll={updateFade}
        aria-label="Admin menu"
        className="relative flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] lg:block lg:space-y-1 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {[...visibleLinks, ...ownerLinks].map((link) => {
          const isActive =
            link.href === '/admin' ? pathname === link.href : pathname.startsWith(link.href)

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? 'page' : undefined}
              className={`block shrink-0 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
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
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#F8F5F2] to-transparent transition-opacity lg:hidden ${
          fade.left ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#F8F5F2] to-transparent transition-opacity lg:hidden ${
          fade.right ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
