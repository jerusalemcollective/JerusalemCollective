import Link from 'next/link'
import { slugifyNeighborhood } from '@/lib/neighborhood-pages'
import { ListingRatingBadge } from '@/components/listing-rating'
import { ListingPrice } from '@/components/listing-price'
import { ListingCardPhotos } from '@/components/listing-card-photos'
import type { ListingRating } from '@/lib/reviews'

// Shared grid for every listing-card list: one big card per row on phones, then
// 2 / 3 / 4 columns. The skeleton uses the same class so loading never jumps.
export const LISTING_GRID_CLASS =
  'grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'

// Photo frame shared with the skeleton.
export const LISTING_CARD_PHOTO_CLASS = 'aspect-[20/19] overflow-hidden rounded-2xl'

export type ListingCardData = {
  id: string
  title: string
  area: string
  bedrooms: number | null
  max_guests: number | null
  coverPhotoUrl: string | null
  // Up to 5 photos in display order (see lib/listing-cards). Falls back to the
  // cover photo when absent.
  photoUrls?: string[]
  rating?: ListingRating | null
  // priceLabel is the server-rendered fallback; when the raw USD/ILS prices are
  // provided the card shows them in the guest's preferred currency (live FX).
  priceLabel: string
  priceUsd?: number | null
  priceIls?: number | null
  hasPrice: boolean
}

// One card used by every listing grid so they can't drift apart. Build the
// props with toListingCardData (lib/listing-cards) rather than by hand.
export function ListingCard({
  listing,
  priority = false,
}: {
  listing: ListingCardData
  priority?: boolean
}) {
  const href = `/listings/${listing.id}?from=stays`
  const photoUrls = listing.photoUrls?.length
    ? listing.photoUrls
    : listing.coverPhotoUrl
      ? [listing.coverPhotoUrl]
      : []

  return (
    <div className="group">
      <div className={`relative bg-stone-100 shadow-sm transition-shadow duration-200 group-hover:shadow-md ${LISTING_CARD_PHOTO_CLASS}`}>
        <ListingCardPhotos href={href} title={listing.title} photoUrls={photoUrls} priority={priority} />
      </div>

      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/neighbourhoods/${slugifyNeighborhood(listing.area)}`}
            className="min-w-0 truncate text-[11px] font-bold uppercase tracking-widest text-[#c76f55] hover:underline"
          >
            {listing.area}
          </Link>
          <ListingRatingBadge rating={listing.rating ?? null} />
        </div>
        <Link href={href} className="block space-y-0.5">
          <p className="line-clamp-2 font-semibold leading-snug text-stone-950" title={listing.title}>
            {listing.title}
          </p>
          <p className="text-sm text-stone-500">
            {[
              listing.bedrooms ? `${listing.bedrooms} bed` : null,
              listing.max_guests ? `sleeps ${listing.max_guests}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="pt-1 text-[15px] font-semibold text-stone-950">
            {listing.priceUsd != null || listing.priceIls != null ? (
              <ListingPrice
                priceUsd={listing.priceUsd ?? null}
                priceIls={listing.priceIls ?? null}
                fallback={listing.priceLabel}
              />
            ) : (
              listing.priceLabel
            )}
            {listing.hasPrice && <span className="font-normal text-stone-500"> / night</span>}
          </p>
        </Link>
      </div>
    </div>
  )
}
