import { Suspense } from 'react'
import { MessagesInbox } from '@/components/messages-inbox'

export default function HostMessagesPage() {
  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Host dashboard</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">Guest messages</h1>
          <p className="mt-2 text-stone-600">
            Reply to enquiries across all of your listings from one place.
          </p>
        </div>
        <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-stone-600 shadow-sm">Loading messages...</div>}>
          <MessagesInbox mode="host" />
        </Suspense>
      </section>
    </main>
  )
}
