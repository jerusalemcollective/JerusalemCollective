import test from 'node:test'
import assert from 'node:assert/strict'
import { filterListings, summarizeSupportCases } from '../lib/marketplace-rules.ts'

const listings = [
  {
    id: 'one',
    area: 'Rechavia',
    bedrooms: 2,
    amenities: ['Sukkah balcony', 'Parking'],
  },
  {
    id: 'two',
    area: 'Romema',
    bedrooms: 4,
    amenities: ['Kosher kitchen', 'Elevator'],
  },
  {
    id: 'three',
    area: 'Rechavia',
    bedrooms: 3,
    amenities: ['Sukkah balcony', 'Kosher kitchen'],
  },
]

test('filterListings combines area, bedrooms, and amenities', () => {
  const result = filterListings(listings, {
    selectedArea: 'Rechavia',
    minimumBedrooms: 3,
    selectedAmenities: ['Sukkah balcony'],
  })

  assert.deepEqual(result.map((listing) => listing.id), ['three'])
})

test('filterListings treats All as every area', () => {
  const result = filterListings(listings, {
    selectedArea: 'All',
    minimumBedrooms: 4,
  })

  assert.deepEqual(result.map((listing) => listing.id), ['two'])
})

test('summarizeSupportCases counts only active queue states', () => {
  const result = summarizeSupportCases([
    { status: 'open' },
    { status: 'under_review' },
    { status: 'waiting_on_guest' },
    { status: 'waiting_on_host' },
    { status: 'resolved' },
  ])

  assert.deepEqual(result, {
    open: 1,
    underReview: 1,
    waitingOnGuest: 1,
    waitingOnHost: 1,
  })
})
