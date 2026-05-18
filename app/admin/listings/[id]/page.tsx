import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { AdminListingMessageForm } from '@/components/admin-listing-message-form'

export default async function AdminListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireAdmin()
  const [{ data: listing }, { data: messages, error: messagesError }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, title, area, host_id, is_published, is_featured, hosts(name)')
      .eq('id', id)
      .single(),
    supabase
      .from('listing_admin_messages')
      .select('id, body, created_at')
      .eq('listing_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!listing) notFound()

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">
        <Link href="/admin/listings" className="hover:text-[#c76f55]">Listings</Link>
        <span>/</span>
        <span className="text-stone-900">{listing.title}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Listing</p>
          <h1 className="mt-2 text-3xl font-bold text-stone-950">{listing.title}</h1>
          <p className="mt-2 text-stone-600">{listing.area}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Info label="Host" value={listing.hosts?.name || 'Host'} />
            <Info label="Published" value={listing.is_published ? 'Live' : 'Hidden'} />
            <Info label="Featured" value={listing.is_featured ? 'Featured' : 'Standard'} />
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-bold text-stone-950">Previous messages</h2>
            <div className="mt-4 space-y-3">
              {messagesError && (
                <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                  We could not load previous listing messages: {messagesError.message}
                </p>
              )}
              {(messages || []).map((message) => (
                <article key={message.id} className="rounded-2xl bg-[#F8F5F2] p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
                    Message from JLM Collective
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-800">{message.body}</p>
                  <p className="mt-2 text-xs text-stone-500">
                    {new Date(message.created_at).toLocaleString('en-GB')}
                  </p>
                </article>
              ))}
              {!messages?.length && (
                <p className="text-sm text-stone-500">No messages sent for this listing yet.</p>
              )}
            </div>
          </div>
        </section>

        <aside className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-stone-950">Message host</h2>
          <div className="mt-4">
            <AdminListingMessageForm listingId={listing.id} />
          </div>
        </aside>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#F8F5F2] p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-stone-900">{value}</p>
    </div>
  )
}
