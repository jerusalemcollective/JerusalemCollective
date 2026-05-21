import { Suspense } from 'react'
import { MessagesInbox, MessagesInboxSkeleton } from '@/components/messages-inbox'
import { Breadcrumb } from '@/components/breadcrumb'

export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const initialConversationId = params?.conversation || null

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-6">
        <Breadcrumb items={[{ label: 'Account', href: '/account' }, { label: 'Messages' }]} />

        <h1 className="mb-8 text-3xl font-bold text-stone-900">Messages</h1>
        <Suspense fallback={<MessagesInboxSkeleton />}>
          <MessagesInbox mode="guest" initialConversationId={initialConversationId} />
        </Suspense>
      </div>
    </div>
  )
}
