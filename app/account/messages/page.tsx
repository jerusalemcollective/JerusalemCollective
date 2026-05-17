import Link from 'next/link'
import { Suspense } from 'react'
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
        <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-stone-600 shadow-sm">Loading messages...</div>}>
          <MessagesInbox mode="guest" />
        </Suspense>
      </div>
    </div>
  )
}
