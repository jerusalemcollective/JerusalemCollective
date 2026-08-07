export const sampleListings = [
  {
    id: 'sample-ramat-eshkol-family-apartment',
    title: 'Ramat Eshkol Family Apartment',
    area: 'Ramat Eshkol',
    bedrooms: 3,
    bathrooms: 2,
    max_guests: 7,
    price_ils: 14900,
    price_usd: 4000,
    booking_type: 'request',
    latitude: 31.7971,
    longitude: 35.2246,
    is_featured: true,
    amenities: ['WiFi', 'Air conditioning', 'Kosher kitchen', 'Family friendly'],
    description:
      'A bright family apartment close to local shuls, groceries, and easy transport around Jerusalem.',
    cover_photo_url: null,
  },
  {
    id: 'sample-jerusalem-estates-bright-stay',
    title: 'Jerusalem Estates Bright Stay',
    area: 'Jerusalem Estates',
    bedrooms: 2,
    bathrooms: 2,
    max_guests: 5,
    price_ils: 14100,
    price_usd: 3800,
    booking_type: 'enquiry',
    latitude: 31.7986,
    longitude: 35.2053,
    is_featured: true,
    amenities: ['WiFi', 'Elevator', 'Parking', 'Shabbos-friendly'],
    description:
      'A calm, polished stay with practical amenities for longer family visits.',
    cover_photo_url: null,
  },
  {
    id: 'sample-romema-spacious-apartment',
    title: 'Romema Spacious Apartment',
    area: 'Romema',
    bedrooms: 4,
    bathrooms: 2,
    max_guests: 9,
    price_ils: 18500,
    price_usd: 4950,
    booking_type: 'instant',
    latitude: 31.7906,
    longitude: 35.2088,
    is_featured: true,
    amenities: ['WiFi', 'Washer', 'Dryer', 'Near shuls'],
    description:
      'A spacious apartment suited to guests who want room to gather and easy neighbourhood access.',
    cover_photo_url: null,
  },
]

export function getSampleListing(id: string) {
  return sampleListings.find((listing) => listing.id === id)
}
