import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'
import { updateListingVisibility } from '@/app/admin/listing-actions'
import { ConfirmSubmitButton } from '@/components/confirm-submit-button'
import { BooleanBadge } from '@/components/boolean-badge'
import { ListingQualityScore } from '@/components/listing-quality-score'
import { Pagination, normalizePaginationSearchParams, type PaginationSearchParams } from '@/components/pagination'
import { calculateListingScore } from '@/lib/marketplace-rules'

const PAGE_SIZE = 25

type ListingRow = {
  id: string
  title: string
  area: string
  host_id: string
  is_published: boolean
  is_featured: boolean
  bedrooms: number | null
  bathrooms: number | null
  amenities: string[] | null
  description: string | null
  price_usd: number | null
  price_ils: number | null
  created_at: string
  hosts?: {
    name: string
  } | null
}

type ListingPhotoRow = {
  listing_id: string | null
}

function buildAdminUrl(
  basePath: string,
  currentParams: Record<string, string | undefined>,
  updates: Record<string, string>,
): string {
  const params = new URLSearchParams()
  Object.entries({
    ...currentParams,
    ...updates,
    page: '1',
  }).forEach(([key, value]) => {
    if (value && value !== 'all') {
      params.set(key, value)
    }
  })
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams?: Promise<PaginationSearchParams>
}) {
  const { supabase } = await requireAdminPermission('listings')
  const currentSearchParams = normalizePaginationSearchParams(searchParams ? await searchParams : {})
  const publishedFilter = currentSearchParams.published || 'all'
  const featuredFilter = currentSearchParams.featured || 'all'
  const page = Math.max(1, Number(currentSearchParams.page) || 1)
  let listingsQuery = supabase
    .from('listings')
    .select('id, title, area, host_id, is_published, is_featured, bedrooms, bathrooms, amenities, description, price_usd, price_ils, created_at, hosts(name)')
    .order('created_at', { ascending: false })
  let countQuery = supabase.from('listings').select('*', { count: 'exact', head: true })

  if (publishedFilter === 'live') {
    listingsQuery = listingsQuery.eq('is_published', true)
    countQuery = countQuery.eq('is_published', true)
  } else if (publishedFilter === 'hidden') {
    listingsQuery = listingsQuery.eq('is_published', false)
    countQuery = countQuery.eq('is_published', false)
  }

  if (featuredFilter === 'featured') {
    listingsQuery = listingsQuery.eq('is_featured', true)
    countQuery = countQuery.eq('is_featured', true)
  } else if (featuredFilter === 'standard') {
    listingsQuery = listingsQuery.eq('is_featured', false)
    countQuery = countQuery.eq('is_featured', false)
  }

  const [{ data }, { count }] = await Promise.all([
    listingsQuery.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    countQuery,
  ])

  const listings = (data || []) as ListingRow[]
  const listingIds = listings.map((listing) => listing.id)
  const { data: photos } = listingIds.length
    ? await supabase
        .from('listing_photos')
        .select('listing_id')
        .in('listing_id', listingIds)
    : { data: [] }
  const photoCounts = countPhotosByListing((photos || []) as ListingPhotoRow[])
  const total = count || 0

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Listings</h2>
        <p className="mt-2 text-stone-600">Control what is live and what gets featured.</p>
      </div>

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'All published states', value: 'all' },
            { label: 'Live', value: 'live' },
            { label: 'Hidden', value: 'hidden' },
          ].map((option) => (
            <Link
              key={option.value}
              href={buildAdminUrl('/admin/listings', currentSearchParams, { published: option.value })}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                publishedFilter === option.value
                  ? 'bg-stone-950 text-white'
                  : 'border border-stone-200 bg-white text-stone-700 hover:border-stone-300'
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'All feature states', value: 'all' },
            { label: 'Featured', value: 'featured' },
            { label: 'Standard', value: 'standard' },
          ].map((option) => (
            <Link
              key={option.value}
              href={buildAdminUrl('/admin/listings', currentSearchParams, { featured: option.value })}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                featuredFilter === option.value
                  ? 'bg-stone-950 text-white'
                  : 'border border-stone-200 bg-white text-stone-700 hover:border-stone-300'
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="grid gap-4 border-b border-stone-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400 md:grid-cols-[1.2fr_0.9fr_0.9fr_0.6fr_0.6fr_1fr]">
          <span>Listing</span>
          <span>Host</span>
          <span>Quality</span>
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
                className="grid gap-4 px-6 py-5 md:grid-cols-[1.2fr_0.9fr_0.9fr_0.6fr_0.6fr_1fr] md:items-center"
              >
                <div>
                  <Link href={`/admin/listings/${listing.id}`} className="font-bold text-stone-950 hover:underline">
                    {listing.title}
                  </Link>
                  <p className="mt-1 text-sm text-stone-500">{listing.area}</p>
                </div>
                <p className="text-sm text-stone-700">{listing.hosts?.name || 'Host'}</p>
                <ListingQualityScore
                  score={calculateListingScore({
                    photo_count: photoCounts.get(listing.id) || 0,
                    description: listing.description,
                    bedrooms: listing.bedrooms,
                    bathrooms: listing.bathrooms,
                    amenities: listing.amenities || [],
                    price_usd: listing.price_usd,
                    price_ils: listing.price_ils,
                  })}
                />
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

function countPhotosByListing(photos: ListingPhotoRow[]) {
  const counts = new Map<string, number>()

  photos.forEach((photo) => {
    if (!photo.listing_id) return
    counts.set(photo.listing_id, (counts.get(photo.listing_id) || 0) + 1)
  })

  return counts
}

