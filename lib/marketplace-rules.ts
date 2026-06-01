type Listing = {
  area: string
  bedrooms: number
  amenities: string[]
  [key: string]: unknown
}

type FilterOptions = {
  selectedArea?: string
  minimumBedrooms?: number
  selectedAmenities?: string[]
}

type SupportCase = {
  status: string
}

type SupportSummary = {
  open: number
  underReview: number
  waitingOnGuest: number
  waitingOnHost: number
}

export type ListingScoreInput = {
  photo_count: number
  description: string | null
  bedrooms: number | null
  bathrooms: number | null
  sleeping_setup?: string | null
  amenities: string[]
  price_usd: number | null
  price_ils: number | null
}

export function filterListings<TListing extends Listing>(
  listings: TListing[],
  options: FilterOptions = {},
) {
  const {
    selectedArea = 'All',
    minimumBedrooms = 0,
    selectedAmenities = [],
  } = options

  return listings.filter((listing) => {
    const matchesArea = selectedArea === 'All' || listing.area === selectedArea
    const matchesBedrooms = listing.bedrooms >= minimumBedrooms
    const matchesAmenities = selectedAmenities.every((amenity) =>
      listing.amenities?.includes(amenity),
    )

    return matchesArea && matchesBedrooms && matchesAmenities
  })
}

export function summarizeSupportCases(cases: SupportCase[]): SupportSummary {
  return cases.reduce(
    (summary, supportCase) => {
      if (supportCase.status === 'open') summary.open += 1
      if (supportCase.status === 'under_review') summary.underReview += 1
      if (supportCase.status === 'waiting_on_guest') summary.waitingOnGuest += 1
      if (supportCase.status === 'waiting_on_host') summary.waitingOnHost += 1
      return summary
    },
    {
      open: 0,
      underReview: 0,
      waitingOnGuest: 0,
      waitingOnHost: 0,
    },
  )
}

export function calculateListingScore(listing: ListingScoreInput): number {
  let score = 0

  score += Math.min(listing.photo_count * 4, 40)

  const descLength = listing.description?.length || 0
  if (descLength > 300) score += 25
  else if (descLength > 150) score += 15
  else if (descLength > 50) score += 5

  if (listing.bedrooms !== null) score += 5
  if (listing.bathrooms !== null) score += 5
  if (listing.sleeping_setup?.trim()) score += 5
  if (listing.price_usd || listing.price_ils) score += 5
  if (listing.amenities.length >= 5) score += 5

  score += Math.min(listing.amenities.length, 15)

  return Math.min(score, 100)
}
