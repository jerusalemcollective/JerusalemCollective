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
  'Hot plate',
  'Hot water urn',
  'In eruv',
  'Family friendly',
  'Crib',
  'High chair',
]

export const STAY_AMENITY_GROUPS = [
  {
    title: 'Everyday comfort',
    amenities: [
      'WiFi',
      'Air conditioning',
      'Heating',
      'Washer',
      'Dryer',
      'Linens and towels',
      'Iron',
      'Hair dryer',
    ],
  },
  {
    title: 'Kitchen',
    amenities: [
      'Oven',
      'Microwave',
      'Dishwasher',
      'Coffee maker',
    ],
  },
  {
    title: 'Building and outdoor',
    amenities: [
      'Parking',
      'Elevator',
      'Balcony',
      'Garden',
    ],
  },
  {
    title: 'Families',
    amenities: [
      'Family friendly',
      'Crib',
      'High chair',
    ],
  },
] as const

// The Shabbos amenities render inside the merged "Shabbos & Jewish stay" section
// (next to the Shabbos booleans), not in the general amenity picker. They still
// save into the listing's amenities array. Kept in STAY_AMENITIES above so they
// count as "known" and never fall through to the free-text "Other" field.
export const SHABBOS_STAY_AMENITIES = ['Hot plate', 'Hot water urn', 'In eruv'] as const

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
