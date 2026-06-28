import { Suspense } from 'react'
import { MessagesInbox, MessagesInboxSkeleton } from '@/components/messages-inbox'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { HostDashboardNav } from '@/components/host-dashboard-nav'

export default async function HostMessagesPage() {
  const { hostIds } = await requireHostDashboardAccess()

  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">
        <HostDashboardNav />
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Host dashboard</p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-stone-950">Guest messages</h1>
          <p className="mt-2 text-stone-600">
            Reply to enquiries across all of your listings from one place.
          </p>
        </div>
        <Suspense fallback={<MessagesInboxSkeleton />}>
          <MessagesInbox mode="host" participantIds={hostIds} />
        </Suspense>
      </section>
    </main>
  )
}
