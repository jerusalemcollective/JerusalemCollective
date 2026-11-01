import { LISTING_CARD_PHOTO_CLASS, LISTING_GRID_CLASS } from '@/components/listing-card'

// Loading placeholder shaped like ListingCard (same photo ratio and text rows).
export function ListingCardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className={`animate-pulse bg-stone-200/70 ${LISTING_CARD_PHOTO_CLASS}`} />
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="h-3 w-20 animate-pulse rounded bg-[#f0dfd8]" />
          <div className="h-4 w-12 animate-pulse rounded-full bg-stone-200/70" />
        </div>
        <div className="h-4 w-11/12 animate-pulse rounded bg-stone-200/70" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-stone-200/70" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-stone-200/70" />
        <div className="h-4 w-24 animate-pulse rounded bg-stone-200/70" />
      </div>
    </div>
  )
}

export function ListingGridSkeleton({ count = 8, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`${LISTING_GRID_CLASS} ${className}`} role="status" aria-label="Loading stays">
      {Array.from({ length: count }).map((_, index) => (
        <ListingCardSkeleton key={index} />
      ))}
    </div>
  )
}
