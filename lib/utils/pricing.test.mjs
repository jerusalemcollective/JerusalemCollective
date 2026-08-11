// Parity guard for computeBookingTotal / computeExtraGuests vs the server RPC
// create_pending_booking_payment (supabase/migrations/105_extra_guest_fee.sql).
// Plain .mjs so `node --test` runs it and tsc skips it.
// Run: `npm test` (node --test) or `node --test lib/utils/pricing.test.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeBookingTotal, computeExtraGuests } from './pricing.ts'

test('flat pricing: no extra guests leaves the total at price x nights', () => {
  const extraGuests = computeExtraGuests(4, 4, 6)
  assert.equal(extraGuests, 0)
  assert.equal(computeBookingTotal({ nightlyPrice: 450, nights: 4, extraGuests, extraGuestFee: 50 }), 1800)
})

test('the sketch case: 6 guests, 4 nights, 4 included, 50/guest = 2200', () => {
  const extraGuests = computeExtraGuests(6, 4, 8)
  assert.equal(extraGuests, 2)
  assert.equal(computeBookingTotal({ nightlyPrice: 450, nights: 4, extraGuests, extraGuestFee: 50 }), 2200)
})

test('zero fee: extra guests cost nothing (opt-out default)', () => {
  const extraGuests = computeExtraGuests(8, 2, 10)
  assert.equal(extraGuests, 6)
  assert.equal(computeBookingTotal({ nightlyPrice: 300, nights: 3, extraGuests, extraGuestFee: 0 }), 900)
})

test('null included_guests falls back to max_guests (no surcharge)', () => {
  assert.equal(computeExtraGuests(5, null, 8), 0)
})

test('null included_guests AND null max_guests falls back to guest count', () => {
  assert.equal(computeExtraGuests(5, null, null), 0)
})

test('guests at exactly the included count is not surcharged', () => {
  assert.equal(computeExtraGuests(4, 4, 6), 0)
})

test('fractional fee rounds to 2dp like Postgres round()', () => {
  // (100 + 1 * 12.505) * 2 = 225.01
  assert.equal(computeBookingTotal({ nightlyPrice: 100, nights: 2, extraGuests: 1, extraGuestFee: 12.505 }), 225.01)
})
