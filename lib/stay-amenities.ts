export const STAY_AMENITIES = [
  'WiFi',
  'Air conditioning',
  'Washer',
  'Dryer',
  'Parking',
  'Elevator',
  'Balcony',
  'Garden',
  'Kosher kitchen',
  'Shabbat-friendly',
  'Sukkah balcony',
  'Near synagogues',
  'Family friendly',
  'Crib / high chair available',
]

export function slugifyAmenity(value: string) {
  return value.toLowerCase().replaceAll('/', '').replaceAll(' ', '-')
}

export function getAmenityLabel(value: string) {
  const normalizedValue = value.toLowerCase()
  return (
    STAY_AMENITIES.find(
      (amenity) => slugifyAmenity(amenity) === normalizedValue || amenity.toLowerCase() === normalizedValue,
    ) || null
  )
}
