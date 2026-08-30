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
      'Kosher kitchen',
      'Oven',
      'Microwave',
      'Dishwasher',
      'Coffee maker',
    ],
  },
  {
    title: 'Shabbos and Jewish stay',
    amenities: [
      'Hot plate',
      'Hot water urn',
      'In eruv',
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
