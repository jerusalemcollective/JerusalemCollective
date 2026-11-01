import type { ListingRating } from '@/lib/reviews'

// Minimum approved reviews before an average is surfaced on a card. Matches the
// avg gate in listing-detail-client (reviews.length >= 2). A single review shows
// as "1 review" and none as a small "New" label, never "0 reviews".
const MIN_REVIEWS = 2

export function ListingRatingBadge({
  rating,
  className = '',
}: {
  rating: ListingRating | null | undefined
  className?: string
}) {
  const count = rating?.count ?? 0

  if (!rating || count === 0) {
    return (
      <span className={`inline-flex shrink-0 rounded-full bg-[#c76f55]/10 px-2 py-0.5 text-[11px] font-semibold text-[#a85a45] ${className}`}>
        New
      </span>
    )
  }

  if (count < MIN_REVIEWS) {
    return <span className={`shrink-0 text-sm text-stone-500 ${className}`}>1 review</span>
  }

  return (
    <span className={`flex shrink-0 items-center gap-1 text-sm text-stone-500 ${className}`}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="#c76f55" stroke="none" aria-hidden="true" className="shrink-0">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      <span className="font-semibold text-stone-950">{rating.avg.toFixed(1)}</span>
      <span aria-hidden="true">({count})</span>
      <span className="sr-only">average rating out of 5, from {count} reviews</span>
    </span>
  )
}
