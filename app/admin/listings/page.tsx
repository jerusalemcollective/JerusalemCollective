import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'
import { archiveListing, deleteListing, updateListingVisibility } from '@/app/admin/listing-actions'
import { ConfirmSubmitButton } from '@/components/confirm-submit-button'
import { BooleanBadge } from '@/components/boolean-badge'
import { ListingQualityScore } from '@/components/listing-quality-score'
import { Pagination, normalizePaginationSearchParams, type PaginationSearchParams } from '@/components/pagination'
import { calculateListingScore } from '@/lib/marketplace-rules'
import { oneOrNull } from '@/lib/utils/one-or-null'

const PAGE_SIZE = 25

type ListingRow = {
  id: string
  title: string
  area: string
  host_id: string
  is_published: boolean
  is_featured: boolean
  admin_status: string | null
  archived_at: string | null
  bedrooms: number | null
  bathrooms: number | null
  sleeping_setup: string | null
  amenities: string[] | null
  description: string | null
  house_rules: string | null
  price_usd: number | null
  price_ils: number | null
  walking_minutes_to_kotel: number | null
  american_comfort: boolean | null
  created_at: string
  hosts?: {
    name: string
  } | null
}

type ListingPhotoRow = {
  listing_id: string | null
}

type ListingShulDistanceRow = {
  listing_id: string | null
}

type ListingQueryRow = Omit<ListingRow, 'hosts'> & {
  hosts?: ListingRow['hosts'] | NonNullable<ListingRow['hosts']>[] | null
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
  const statusFilter = currentSearchParams.status || 'all'
  const page = Math.max(1, Number(currentSearchParams.page) || 1)
  let listingsQuery = supabase
    .from('listings')
    .select('id, title, area, host_id, is_published, is_featured, admin_status, archived_at, bedrooms, bathrooms, sleeping_setup, amenities, description, house_rules, price_usd, price_ils, walking_minutes_to_kotel, american_comfort, created_at, hosts(name)')
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

  if (['needs_work', 'ready_for_launch', 'live'].includes(statusFilter)) {
    listingsQuery = listingsQuery.eq('admin_status', statusFilter)
    countQuery = countQuery.eq('admin_status', statusFilter)
  }

  const [{ data }, { count }] = await Promise.all([
    listingsQuery.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    countQuery,
  ])

  const listings: ListingRow[] = (data || []).map((listing: ListingQueryRow) => ({
    ...listing,
    hosts: oneOrNull(listing.hosts),
  }))
  const listingIds = listings.map((listing) => listing.id)
  const [{ data: photos }, { data: shulDistances }] = await Promise.all([
    listingIds.length
      ? supabase
          .from('listing_photos')
          .select('listing_id')
          .in('listing_id', listingIds)
      : Promise.resolve({ data: [] }),
    listingIds.length
      ? supabase
          .from('listing_shul_distances')
          .select('listing_id')
          .in('listing_id', listingIds)
      : Promise.resolve({ data: [] }),
  ])
  const photoRows: ListingPhotoRow[] = (photos || []).map((photo: ListingPhotoRow) => ({
    listing_id: photo.listing_id,
  }))
  const shulDistanceRows: ListingShulDistanceRow[] = (shulDistances || []).map((distance: ListingShulDistanceRow) => ({
    listing_id: distance.listing_id,
  }))
  const photoCounts = countPhotosByListing(photoRows)
  const shulDistanceCounts = countShulDistancesByListing(shulDistanceRows)
  const total = count || 0

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-stone-950">Listings</h2>
        </div>
        <Link
          href="/admin/listings/new"
          className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-stone-800"
        >
          Create listing
        </Link>
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
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'All launch statuses', value: 'all' },
            { label: 'Needs work', value: 'needs_work' },
            { label: 'Ready for launch', value: 'ready_for_launch' },
            { label: 'Live status', value: 'live' },
          ].map((option) => (
            <Link
              key={option.value}
              href={buildAdminUrl('/admin/listings', currentSearchParams, { status: option.value })}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                statusFilter === option.value
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
        <div className="grid gap-4 border-b border-stone-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-500 md:grid-cols-[1.7fr_0.9fr_1fr_1.9fr]">
          <span>Listing</span>
          <span>Host</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {listings.length === 0 ? (
          <div className="px-6 py-12 text-center text-stone-500">No listings yet.</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className={`grid gap-4 px-6 py-5 md:grid-cols-[1.7fr_0.9fr_1fr_1.9fr] md:items-center ${
                  listing.archived_at ? 'bg-stone-50' : ''
                }`}
              >
                <div className="min-w-0">
                  <Link href={`/admin/listings/${listing.id}`} className="font-bold text-stone-950 hover:underline">
                    {listing.title}
                  </Link>
                  <p className="mt-1 text-sm text-stone-500">{listing.area}</p>
                  <div className="mt-2">
                    <ListingQualityScore
                      score={calculateListingScore({
                        photo_count: photoCounts.get(listing.id) || 0,
                        description: listing.description,
                        bedrooms: listing.bedrooms,
                        bathrooms: listing.bathrooms,
                        sleeping_setup: listing.sleeping_setup,
                        amenities: listing.amenities || [],
                        price_usd: listing.price_usd,
                        price_ils: listing.price_ils,
                      })}
                      suggestions={listingQaSuggestions(
                        listing,
                        photoCounts.get(listing.id) || 0,
                        shulDistanceCounts.get(listing.id) || 0,
                      )}
                    />
                  </div>
                </div>

                <p className="text-sm text-stone-700">{listing.hosts?.name || 'Host'}</p>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-700">
                    {adminStatusLabel(listing.admin_status)}
                  </span>
                  {listing.archived_at ? (
                    <span className="rounded-full bg-stone-800 px-2.5 py-1 text-[11px] font-bold text-white">
                      Archived
                    </span>
                  ) : (
                    <BooleanBadge value={listing.is_published} yes="Live" no="Hidden" />
                  )}
                  {listing.is_featured && (
                    <span className="rounded-full bg-[#fff4ef] px-2.5 py-1 text-[11px] font-bold text-[#c76f55]">
                      Featured
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {listing.archived_at ? (
                    <form action={archiveListing}>
                      <input type="hidden" name="listingId" value={listing.id} />
                      <input type="hidden" name="restore" value="true" />
                      <ConfirmSubmitButton
                        message="Restore this listing? It will return to the admin list as hidden, so you can review it before publishing."
                        className="rounded-full bg-[#252525] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#111111]"
                      >
                        Restore
                      </ConfirmSubmitButton>
                    </form>
                  ) : (
                    <>
                      <form action={updateListingVisibility}>
                        <input type="hidden" name="listingId" value={listing.id} />
                        <input type="hidden" name="field" value="is_published" />
                        <input type="hidden" name="value" value={String(!listing.is_published)} />
                        <ConfirmSubmitButton
                          message={listing.is_published ? 'Hide this listing from the public site?' : 'Publish this listing to the public site?'}
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
                          message={listing.is_featured ? 'Remove this listing from the featured set?' : 'Feature this listing on the homepage?'}
                          className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 transition hover:border-stone-300"
                        >
                          {listing.is_featured ? 'Unfeature' : 'Feature'}
                        </ConfirmSubmitButton>
                      </form>
                    </>
                  )}

                  <Link
                    href={`/admin/listings/${listing.id}`}
                    className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 transition hover:border-stone-300"
                  >
                    Edit
                  </Link>

                  {!listing.archived_at && (
                    <form action={archiveListing}>
                      <input type="hidden" name="listingId" value={listing.id} />
                      <ConfirmSubmitButton
                        message="Archive this listing? It comes off the public site immediately and keeps its booking history. You can restore it at any time."
                        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
                      >
                        Archive
                      </ConfirmSubmitButton>
                    </form>
                  )}

                  <form action={deleteListing}>
                    <input type="hidden" name="listingId" value={listing.id} />
                    <ConfirmSubmitButton
                      message="Delete this listing permanently? This cannot be undone. If it has bookings or reviews the delete will be refused - archive it instead."
                      className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700"
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </form>
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

function countShulDistancesByListing(distances: ListingShulDistanceRow[]) {
  const counts = new Map<string, number>()

  distances.forEach((distance) => {
    if (!distance.listing_id) return
    counts.set(distance.listing_id, (counts.get(distance.listing_id) || 0) + 1)
  })

  return counts
}

function listingQaSuggestions(
  listing: ListingRow,
  photoCount: number,
  shulDistanceCount: number,
) {
  const suggestions: string[] = []

  if (photoCount < 5) suggestions.push('Add at least five photos before publishing.')
  if (!listing.price_usd && !listing.price_ils) suggestions.push('Add a clear nightly price.')
  if (!listing.sleeping_setup?.trim()) suggestions.push('Add the sleeping setup.')
  if (!listing.house_rules?.trim()) suggestions.push('Add house rules for guests.')
  if (!listing.walking_minutes_to_kotel && shulDistanceCount === 0) {
    suggestions.push('Add shul or Old City walking distance.')
  }
  if (!listing.american_comfort) suggestions.push('Confirm American comfort details.')

  return suggestions.slice(0, 4)
}

function adminStatusLabel(status: string | null) {
  if (status === 'ready_for_launch') return 'Ready'
  if (status === 'live') return 'Live'
  return 'Needs work'
}

