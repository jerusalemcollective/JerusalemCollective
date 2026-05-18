export function filterListings(listings, options = {}) {
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

export function summarizeSupportCases(cases) {
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
