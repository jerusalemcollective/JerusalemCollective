// Guards for the plain-words booking helpers used on the admin booking pages.
// Run: `node --test tests/booking-display.test.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bookingNights,
  bookingStatusLabel,
  bookingTotal,
  enquiryOutcomeLabel,
  formatDateRange,
  formatMoney,
  bookingGuestName,
  paymentMethodLabel,
} from '../lib/booking-display.ts'

const today = '2026-06-10'

test('status labels follow the real bookings.status values', () => {
  assert.equal(bookingStatusLabel({ status: 'pending' }, today).label, 'Pending payment')
  assert.equal(bookingStatusLabel({ status: 'cancelled' }, today).label, 'Cancelled')
  assert.equal(bookingStatusLabel({ status: 'cancelled', payment_status: 'refunded' }, today).label, 'Cancelled · refunded')
  assert.equal(bookingStatusLabel({ status: 'confirmed', check_in: '2026-07-01', check_out: '2026-07-05' }, today).label, 'Confirmed')
  assert.equal(bookingStatusLabel({ status: 'confirmed', check_in: '2026-06-08', check_out: '2026-06-12' }, today).label, 'Staying now')
  assert.equal(bookingStatusLabel({ status: 'confirmed', check_in: '2026-06-01', check_out: '2026-06-05' }, today).label, 'Completed')
})

test('enquiry outcome prefers the linked booking', () => {
  assert.equal(enquiryOutcomeLabel('accepted', { status: 'confirmed', check_in: '2026-07-01', check_out: '2026-07-03' }, today).label, 'Booked')
  assert.equal(enquiryOutcomeLabel('accepted', { status: 'cancelled' }, today).label, 'Cancelled')
  assert.equal(enquiryOutcomeLabel('declined', null, today).label, 'Declined')
  assert.equal(enquiryOutcomeLabel('new', null, today).label, 'Awaiting host')
})

test('nights and date ranges', () => {
  assert.equal(bookingNights('2026-03-28', '2026-04-02'), 5)
  assert.equal(bookingNights('2026-03-29', '2026-03-29'), 0)
  assert.equal(bookingNights(null, '2026-03-29'), 0)
  assert.equal(formatDateRange('2026-03-03', '2026-03-07'), '3 – 7 Mar 2026')
  assert.equal(formatDateRange('2026-03-28', '2026-04-02'), '28 Mar – 2 Apr 2026')
  assert.equal(formatDateRange('2026-12-28', '2027-01-02'), '28 Dec 2026 – 2 Jan 2027')
})

test('amounts and names', () => {
  assert.deepEqual(bookingTotal({ total_amount_usd: 1200, total_amount_ils: 4400 }, 'ILS'), { amount: 4400, currency: 'ILS' })
  assert.deepEqual(bookingTotal({ total_amount_usd: 1200, total_amount_ils: 4400 }), { amount: 1200, currency: 'USD' })
  assert.equal(bookingTotal({}), null)
  assert.equal(formatMoney(1250, 'USD'), '$1,250')
  assert.equal(formatMoney(4800, 'ILS'), '₪4,800')
  assert.equal(bookingGuestName({ full_name: '  ', email: 'a@b.co' }), 'a@b.co')
  assert.equal(bookingGuestName({}), 'Guest')
  assert.equal(paymentMethodLabel('platform_checkout'), 'Card through JLM')
  assert.equal(paymentMethodLabel('direct_to_host'), 'Transfer to host')
})
