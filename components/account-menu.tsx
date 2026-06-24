'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  CalendarDays,
  Heart,
  Home,
  LifeBuoy,
  MessageCircle,
  MessageSquare,
  Plus,
  ShieldCheck,
  Star,
  UserRound,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function AccountMenu({ hasStay, isAdmin }: { hasStay: boolean; isAdmin: boolean }) {
  const pathname = usePathname()
  const [guestUnreadCount, setGuestUnreadCount] = useState(0)
  const [hostUnreadCount, setHostUnreadCount] = useState(0)

  useEffect(() => {
    let isActive = true

    async function loadUnreadCount() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: guestConversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant_1', user.id)

      const guestConversationIds = (guestConversations || [])
        .map((conversation: { id: string }) => conversation.id)
        .filter(Boolean)

      let hostConversationIds: string[] = []
      if (hasStay) {
        const { data: hostRows } = await supabase
          .from('hosts')
          .select('id')
          .or(`id.eq.${user.id},user_id.eq.${user.id}`)

        const hostIds = Array.from(
          new Set([user.id, ...(hostRows || []).map((host: { id: string }) => host.id)].filter(Boolean)),
        )

        if (hostIds.length > 0) {
          const { data: hostConversations } = await supabase
            .from('conversations')
            .select('id')
            .in('participant_2', hostIds)

          hostConversationIds = (hostConversations || [])
            .map((conversation: { id: string }) => conversation.id)
            .filter(Boolean)
        }
      }

      const countUnread = async (conversationIds: string[]) => {
        if (conversationIds.length === 0) return 0

        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', conversationIds)
          .eq('read', false)
          .neq('sender_id', user.id)

        return count || 0
      }

      const [guestUnread, hostUnread] = await Promise.all([
        countUnread(guestConversationIds),
        countUnread(hostConversationIds),
      ])

      if (isActive) {
        setGuestUnreadCount(guestUnread)
        setHostUnreadCount(hostUnread)
      }
    }

    void loadUnreadCount()
    const handleFocus = () => {
      void loadUnreadCount()
    }
    const handleMessagesRead = () => {
      void loadUnreadCount()
    }
    window.addEventListener('focus', handleFocus)
    window.addEventListener('messages-read', handleMessagesRead)

    return () => {
      isActive = false
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('messages-read', handleMessagesRead)
    }
  }, [hasStay])

  return (
    <nav className="space-y-1">
      <MenuLink href="/account" label="Profile" icon={<UserRound className="h-5 w-5" />} active={pathname === '/account'} />
      <MenuLink href="/account/bookings" label="My trips" icon={<CalendarDays className="h-5 w-5" />} active={pathname === '/account/bookings'} />
      <MenuLink href="/account/reviews" label="Reviews" icon={<Star className="h-5 w-5" />} active={pathname === '/account/reviews'} />
      <MenuLink href="/account/enquiries" label="Enquiries" icon={<MessageSquare className="h-5 w-5" />} active={pathname === '/account/enquiries'} />
      <MenuLink href="/account/saved" label="Saved" icon={<Heart className="h-5 w-5" />} active={pathname === '/account/saved'} />
      <MenuLink
        href="/account/messages"
        label={hasStay ? 'Guest messages' : 'Messages'}
        icon={<MessageCircle className="h-5 w-5" />}
        active={pathname === '/account/messages'}
        badge={guestUnreadCount}
      />
      {hasStay && (
        <MenuLink
          href="/host/dashboard/messages"
          label="Host messages"
          icon={<MessageCircle className="h-5 w-5" />}
          active={pathname === '/host/dashboard/messages'}
          badge={hostUnreadCount}
        />
      )}
      <MenuLink href="/account/support" label="Support" icon={<LifeBuoy className="h-5 w-5" />} active={pathname === '/account/support'} />

      <div className="mt-3 space-y-2 border-t border-stone-200 pt-4">
        {hasStay ? (
          <>
            <MenuLink href="/host/dashboard" label="Host dashboard" icon={<Home className="h-5 w-5" />} accent />
          </>
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
  badge = 0,
}: {
  href: string
  label: string
  icon: ReactNode
  active?: boolean
  accent?: boolean
  badge?: number
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
        active
          ? 'border-b-2 border-[#c76f55] bg-white font-bold text-[#c76f55] shadow-sm'
          : accent
            ? 'border border-[#c76f55] text-[#c76f55] hover:bg-[#fff4ef]'
            : 'text-stone-600 hover:bg-white hover:text-stone-900 hover:shadow-sm'
      }`}
    >
      {icon}
      <span className="flex flex-1 items-center gap-2">
        <span>{label}</span>
        {badge > 0 && (
          <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white">
            {badge}
          </span>
        )}
      </span>
    </Link>
  )
}
