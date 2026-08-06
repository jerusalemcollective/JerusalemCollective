'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeftRight,
  Bell,
  CalendarDays,
  CreditCard,
  Home,
  LifeBuoy,
  ListChecks,
  MessageCircle,
} from 'lucide-react'

const links = [
  { href: '/host/dashboard', label: 'Overview', icon: Home },
  { href: '/host/dashboard/listings', label: 'Listings', icon: ListChecks },
  { href: '/host/dashboard/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/host/dashboard/messages', label: 'Messages', icon: MessageCircle },
  { href: '/host/dashboard/cases', label: 'Cases', icon: LifeBuoy },
  { href: '/host/dashboard/payments', label: 'Payments', icon: CreditCard },
  { href: '/host/dashboard/notifications', label: 'Notifications', icon: Bell },
]

export function HostDashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="space-y-1">
      {links.map((link) => {
        const Icon = link.icon
        const isActive =
          link.href === '/host/dashboard'
            ? pathname === link.href
            : pathname.startsWith(link.href)

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
              isActive
                ? 'border-b-2 border-[#c76f55] bg-white font-bold text-[#c76f55] shadow-sm'
                : 'text-stone-600 hover:bg-white hover:text-stone-900 hover:shadow-sm'
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{link.label}</span>
          </Link>
        )
      })}

      <div className="mt-3 border-t border-stone-200 pt-3">
        <Link
          href="/choose-dashboard?switch=1"
          className="flex items-center gap-3 rounded-lg border border-[#c76f55] px-3.5 py-2.5 text-sm font-medium text-[#c76f55] transition hover:bg-[#fff4ef]"
        >
          <ArrowLeftRight className="h-5 w-5" />
          <span>Switch dashboard</span>
        </Link>
      </div>
    </nav>
  )
}
