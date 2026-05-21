export const STAY_AMENITIES = [
  'WiFi',
  'Air conditioning',
  'Heating',
  'Washer',
  'Dryer',
  'Linens and towels',
  'Iron',
  'Hair dryer',
  'Parking',
  'Elevator',
  'Balcony',
  'Garden',
  'Kosher kitchen',
  'Oven',
  'Microwave',
  'Dishwasher',
  'Coffee maker',
  'Shabbat-friendly',
  'Hot plate',
  'Hot water urn',
  'Shabbat elevator',
  'Near synagogues',
  'In eruv',
  'Sukkah',
  'Family friendly',
  'Crib',
  'High chair',
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
