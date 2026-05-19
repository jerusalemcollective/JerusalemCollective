'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import {
  CalendarDays,
  Heart,
  Home,
  LifeBuoy,
  MessageCircle,
  Plus,
  ShieldCheck,
  UserRound,
} from 'lucide-react'

export function AccountMenu({ hasStay, isAdmin }: { hasStay: boolean; isAdmin: boolean }) {
  const pathname = usePathname()

  return (
    <nav className="space-y-1">
      <MenuLink href="/account" label="Profile" icon={<UserRound className="h-5 w-5" />} active={pathname === '/account'} />
      <MenuLink href="/account/bookings" label="My trips" icon={<CalendarDays className="h-5 w-5" />} active={pathname === '/account/bookings'} />
      <MenuLink href="/account/saved" label="Saved" icon={<Heart className="h-5 w-5" />} active={pathname === '/account/saved'} />
      <MenuLink href="/account/messages" label="Messages" icon={<MessageCircle className="h-5 w-5" />} active={pathname === '/account/messages'} />
      <MenuLink href="/account/support" label="Support" icon={<LifeBuoy className="h-5 w-5" />} active={pathname === '/account/support'} />

      <div className="pt-4">
        {hasStay ? (
          <MenuLink href="/host/dashboard" label="Host dashboard" icon={<Home className="h-5 w-5" />} accent />
        ) : (
          <MenuLink href="/become-a-host" label="Become a host" icon={<Plus className="h-5 w-5" />} accent />
        )}
        {isAdmin && (
          <MenuLink href="/admin" label="Admin workspace" icon={<ShieldCheck className="h-5 w-5" />} accent />
        )}
      </div>
    </nav>
  )
}

function MenuLink({
  href,
  label,
  icon,
  active = false,
  accent = false,
}: {
  href: string
  label: string
  icon: ReactNode
  active?: boolean
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-4 py-3 font-medium transition ${
        active
          ? 'bg-white text-stone-950 shadow-sm'
          : accent
            ? 'border border-[#c76f55] text-[#c76f55] hover:bg-[#fff4ef]'
            : 'text-stone-600 hover:bg-white hover:text-stone-950 hover:shadow-sm'
      }`}
    >
      {icon}
      {label}
    </Link>
  )
}
