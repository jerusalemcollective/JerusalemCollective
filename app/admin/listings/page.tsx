import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'
import { updateListingVisibility } from '@/app/admin/listing-actions'
import { ConfirmSubmitButton } from '@/components/confirm-submit-button'
import { BooleanBadge } from '@/components/boolean-badge'
import { Pagination, normalizePaginationSearchParams, type PaginationSearchParams } from '@/components/pagination'

const PAGE_SIZE = 25

type ListingRow = {
  id: string
  title: string
  area: string
  host_id: string
  is_published: boolean
  is_featured: boolean
  created_at: string
  hosts?: {
    name: string
  } | null
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<PaginationSearchParams>
}) {
  const { supabase } = await requireAdminPermission('listings')
  const currentSearchParams = normalizePaginationSearchParams(await searchParams)
  const page = Math.max(1, Number(currentSearchParams.page) || 1)
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, title, area, host_id, is_published, is_featured, created_at, hosts(name)')
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('listings').select('*', { count: 'exact', head: true }),
  ])

  const listings = (data || []) as ListingRow[]
  const total = count || 0

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Listings</h2>
        <p className="mt-2 text-stone-600">Control what is live and what gets featured.</p>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="grid gap-4 border-b border-stone-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400 md:grid-cols-[1.3fr_1fr_0.7fr_0.7fr_1fr]">
          <span>Listing</span>
          <span>Host</span>
          <span>Published</span>
          <span>Featured</span>
          <span>Actions</span>
        </div>

        {listings.length === 0 ? (
          <div className="px-6 py-12 text-center text-stone-500">No listings yet.</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="grid gap-4 px-6 py-5 md:grid-cols-[1.3fr_1fr_0.7fr_0.7fr_1fr] md:items-center"
              >
                <div>
                  <Link href={`/admin/listings/${listing.id}`} className="font-bold text-stone-950 hover:underline">
                    {listing.title}
                  </Link>
                  <p className="mt-1 text-sm text-stone-500">{listing.area}</p>
                </div>
                <p className="text-sm text-stone-700">{listing.hosts?.name || 'Host'}</p>
                <BooleanBadge value={listing.is_published} yes="Live" no="Hidden" />
                <BooleanBadge value={listing.is_featured} yes="Featured" no="Standard" />
                <div className="flex flex-wrap gap-2">
                  <form action={updateListingVisibility}>
                    <input type="hidden" name="listingId" value={listing.id} />
                    <input type="hidden" name="field" value="is_published" />
                    <input type="hidden" name="value" value={String(!listing.is_published)} />
                    <ConfirmSubmitButton
                      message="Are you sure?"
                      className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 transition hover:border-stone-300"
                    >
                      {listing.is_published ? 'Hide' : 'Publish'}
                    </ConfirmSubmitButton>
                  </form>
                  <form action={updateListingVisibility}>
                    <input type="hidden" name="listingId" value={listing.id} />
                    <input type="hidden" name="field" value="is_featured" />
                    <input type="hidden" name="value" value={String(!listing.is_featured)} />
                    <ConfirmSubmitButton
                      message="Are you sure?"
                      className="rounded-full bg-[#252525] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#111111]"
                    >
                      {listing.is_featured ? 'Unfeature' : 'Feature'}
                    </ConfirmSubmitButton>
                  </form>
                  <Link
                    href={`/admin/listings/${listing.id}`}
                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
                  >
                    Message host
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} basePath="/admin/listings" searchParams={currentSearchParams} />
    </div>
  )
}
