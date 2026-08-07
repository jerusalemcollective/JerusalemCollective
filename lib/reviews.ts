import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

export type ListingRating = {
  avg: number
  count: number
}

const reviewRatingRowSchema = z.object({
  listing_id: z.string().nullable(),
  rating: z.number(),
})

// Batched aggregate of APPROVED review ratings for a set of listings in one
// query. RLS already limits anon reads to is_approved = true (migration 036);
// we filter explicitly so cookie/admin clients behave identically. Listings
// with no approved reviews are absent from the map, so callers render nothing.
export async function getListingRatings(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<Map<string, ListingRating>> {
  const ratings = new Map<string, ListingRating>()
  if (listingIds.length === 0) return ratings

  try {
    const { data } = await supabase
      .from('reviews')
      .select('listing_id, rating')
      .eq('is_approved', true)
      .in('listing_id', listingIds)

    const sums = new Map<string, { total: number; count: number }>()
    for (const row of z.array(reviewRatingRowSchema).parse(data ?? [])) {
      if (!row.listing_id) continue
      const current = sums.get(row.listing_id) ?? { total: 0, count: 0 }
      current.total += row.rating
      current.count += 1
      sums.set(row.listing_id, current)
    }

    for (const [listingId, { total, count }] of sums) {
      ratings.set(listingId, { avg: total / count, count })
    }
  } catch {
    // Never let a reviews read break the listings grid.
  }

  return ratings
}
