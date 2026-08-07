import Link from 'next/link'
import Image from 'next/image'
import { slugifyNeighborhood } from '@/lib/neighborhood-pages'
import { ListingRatingBadge } from '@/components/listing-rating'
import type { ListingRating } from '@/lib/reviews'

export type ListingCardData = {
  id: string
  title: string
  area: string
  bedrooms: number | null
  max_guests: number | null
  coverPhotoUrl: string | null
  rating?: ListingRating | null
  // Pre-formatted so each surface keeps its own currency formatting.
  priceLabel: string
  hasPrice: boolean
}

// One card used across the homepage, the stays search, and collection pages so
// they can't drift apart. Callers format the price themselves and pass it in.
export function ListingCard({
  listing,
  priority = false,
}: {
  listing: ListingCardData
  priority?: boolean
}) {
  return (
    <div className="group">
      <Link href={`/listings/${listing.id}?from=stays`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100 shadow-sm transition-shadow duration-200 group-hover:shadow-md">
          {listing.coverPhotoUrl ? (
            <Image
              src={listing.coverPhotoUrl}
              alt={listing.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              {...(priority ? { priority: true } : { loading: 'lazy' as const })}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#F8F5F2]">
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#c76f55]">JLM Collective</p>
                <p className="mt-1 text-xs text-stone-600">Photo coming soon</p>
              </div>
            </div>
          )}
        </div>
      </Link>

      <div className="mt-3 space-y-0.5">
        <Link
          href={`/neighbourhoods/${slugifyNeighborhood(listing.area)}`}
          className="block text-[11px] font-bold uppercase tracking-widest text-[#c76f55] hover:underline"
        >
          {listing.area}
        </Link>
        <Link href={`/listings/${listing.id}?from=stays`} className="block space-y-0.5">
          <p className="line-clamp-1 font-semibold leading-snug text-stone-950">{listing.title}</p>
          <ListingRatingBadge rating={listing.rating ?? null} />
          <p className="text-sm text-stone-500">
            {[
              listing.bedrooms ? `${listing.bedrooms} bed` : null,
              listing.max_guests ? `sleeps ${listing.max_guests}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="pt-1 text-sm font-semibold text-stone-950">
            {listing.priceLabel}
            {listing.hasPrice && <span className="font-normal text-stone-500"> / night</span>}
          </p>
        </Link>
      </div>
    </div>
  )
}
