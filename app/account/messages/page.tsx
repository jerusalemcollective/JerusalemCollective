'use client'

import Link from 'next/link'
import { MessagesInbox } from '@/components/messages-inbox'

export default function MessagesPage() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-6">
        <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">
          <Link href="/account" className="hover:text-[#c76f55]">Account</Link>
          <span>/</span>
          <span className="text-stone-900">Messages</span>
        </div>

        <h1 className="mb-8 text-3xl font-bold text-stone-900">Messages</h1>
        <MessagesInbox mode="guest" />
      </div>
    </div>
  )
}
