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
  'In eruv',
  'Family friendly',
  'Crib',
  'High chair',
]

export const STAY_AMENITY_GROUPS = [
  {
    title: 'Everyday comfort',
    description: 'The essentials guests expect for an easy stay.',
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
    description: 'Cooking and food preparation features.',
    amenities: [
      'Kosher kitchen',
      'Oven',
      'Microwave',
      'Dishwasher',
      'Coffee maker',
    ],
  },
  {
    title: 'Shabbat and Jewish stay',
    description: 'Details that matter for Shabbat and yom tov stays.',
    amenities: [
      'Shabbat-friendly',
      'Hot plate',
      'Hot water urn',
      'In eruv',
    ],
  },
  {
    title: 'Building and outdoor',
    description: 'Access, parking, and outdoor space.',
    amenities: [
      'Parking',
      'Elevator',
      'Balcony',
      'Garden',
    ],
  },
  {
    title: 'Families',
    description: 'Helpful extras for guests travelling with children.',
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
