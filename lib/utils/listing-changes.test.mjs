// Guards for the "host changed their listing" wording in lib/utils/listing-changes.ts.
// Run: `node --test lib/utils/listing-changes.test.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffListing, fullChangePhrase, mergeChangeSets, shortChangePhrase } from './listing-changes.ts'

const base = {
  title: 'Sunny flat',
  area: 'Baka',
  price: 500,
  price_currency: 'ILS',
  price_ils: 500,
  price_usd: 135,
  description: 'Lovely',
  amenities: ['Wifi', 'Balcony'],
  shabbat_clock: false,
  house_rules: null,
  check_in_time: '15:00:00',
}

test('no change means no fields, even when FX-converted columns move', () => {
  const after = { ...base, price_usd: 137, amenities: ['balcony', 'wifi'], house_rules: '', check_in_time: '15:00' }
  assert.deepEqual(diffListing(base, after), { fields: [] })
})

test('price and description changes read in plain words with old → new price', () => {
  const changes = diffListing(base, { ...base, price: 550, description: 'Lovely and bright' })
  assert.deepEqual(changes.fields, ['price', 'description'])
  assert.equal(shortChangePhrase(changes), 'the price and description')
  assert.equal(fullChangePhrase(changes), 'the price (₪500 → ₪550) and description')
})

test('a column missing from a row is ignored', () => {
  const { check_in_time: _omit, ...withoutTimes } = base
  assert.deepEqual(diffListing(withoutTimes, { ...base, check_in_time: '16:00' }), { fields: [] })
})

test('merging keeps every field and the first old and last new price', () => {
  const first = diffListing(base, { ...base, price: 550 })
  const second = diffListing({ ...base, price: 550 }, { ...base, price: 600, title: 'Sunny flat in Baka' })
  const merged = mergeChangeSets(first, second)
  assert.deepEqual(merged.fields, ['title', 'price'])
  assert.deepEqual(merged.price, { from: '₪500', to: '₪600' })
})

test('a price changed and changed back drops out of the merge', () => {
  const first = diffListing(base, { ...base, price: 550 })
  const second = diffListing({ ...base, price: 550 }, { ...base, price: 550, description: 'New' })
  const back = diffListing({ ...base, price: 550, description: 'New' }, { ...base, description: 'New' })
  const merged = mergeChangeSets(mergeChangeSets(first, second), back)
  assert.deepEqual(merged, { fields: ['description'] })
})

test('many fields get a short subject phrase', () => {
  const changes = { fields: ['title', 'area', 'bedrooms', 'amenities', 'description'] }
  assert.equal(shortChangePhrase(changes), '5 things')
  assert.equal(fullChangePhrase(changes), 'the title, area, number of bedrooms, amenities and description')
})
