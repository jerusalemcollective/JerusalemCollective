import type { ListingRating } from '@/lib/reviews'

// Minimum approved reviews before a rating is surfaced on a card. Matches the
// avg gate in listing-detail-client (reviews.length >= 2). Lower to 1 if
// single-review ratings are desired.
const MIN_REVIEWS = 2

export function ListingRatingBadge({
  rating,
  className = '',
}: {
  rating: ListingRating | null | undefined
  className?: string
}) {
  if (!rating || rating.count < MIN_REVIEWS) return null

  return (
    <span className={`flex items-center gap-1 text-sm text-stone-500 ${className}`}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="#c76f55" stroke="none" aria-hidden="true" className="shrink-0">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      <span className="font-semibold text-stone-950">{rating.avg.toFixed(1)}</span>
      <span aria-hidden="true">·</span>
      <span>{rating.count}</span>
      <span className="sr-only">average rating out of 5, from {rating.count} reviews</span>
    </span>
  )
}
