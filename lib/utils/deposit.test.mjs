// Parity guard for computeDepositPreview vs the server RPC create_pending_booking_payment
// (supabase/migrations/092_deposit_commission_floor_and_due_clamp.sql). Plain .mjs so
// `node --test` (Node's built-in runner, native TS stripping) runs it and tsc skips it.
// Run: `pnpm test` (node --test) or `node --test lib/utils/deposit.test.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeDepositPreview } from './deposit.ts'

// Fixed check-in / today so the due-date clamp is deterministic (local dates).
const checkIn = new Date(2026, 11, 1) // 1 Dec 2026
const today = new Date(2026, 7, 9) //    9 Aug 2026
const base = { balanceDueDaysBeforeCheckin: 0, checkIn, today }

test('percent deposit: 10% split leaves a 90% balance', () => {
  const r = computeDepositPreview({ ...base, bookingTotal: 12340, depositType: 'percent', depositValue: 10 })
  assert.equal(r.depositAmount, 1234)
  assert.equal(r.balanceAmount, 11106)
  assert.equal(r.balanceStatus, 'due')
})

test('percent deposit: 100% leaves no balance', () => {
  const r = computeDepositPreview({ ...base, bookingTotal: 5000, depositType: 'percent', depositValue: 100 })
  assert.equal(r.depositAmount, 5000)
  assert.equal(r.balanceAmount, 0)
  assert.equal(r.balanceStatus, 'none')
})

test('fixed deposit >= total is capped at total', () => {
  const r = computeDepositPreview({ ...base, bookingTotal: 800, depositType: 'fixed', depositValue: 1000 })
  assert.equal(r.depositAmount, 800)
  assert.equal(r.balanceAmount, 0)
  assert.equal(r.balanceStatus, 'none')
})

test('sub-0.50 fixed deposit is floored to Stripe minimum', () => {
  const r = computeDepositPreview({ ...base, bookingTotal: 500, depositType: 'fixed', depositValue: 0.2 })
  assert.equal(r.depositAmount, 0.5)
  assert.equal(r.balanceAmount, 499.5)
  assert.equal(r.balanceStatus, 'due')
})

test('percent of a non-round total rounds the split to 2 decimals', () => {
  // 25% of 401 = 100.25 exactly; balance 300.75.
  const r = computeDepositPreview({ ...base, bookingTotal: 401, depositType: 'percent', depositValue: 25 })
  assert.equal(r.depositAmount, 100.25)
  assert.equal(r.balanceAmount, 300.75)
})

test('fixed 2-dp deposit passes through unchanged', () => {
  const r = computeDepositPreview({ ...base, bookingTotal: 1000, depositType: 'fixed', depositValue: 123.45 })
  assert.equal(r.depositAmount, 123.45)
  assert.equal(r.balanceAmount, 876.55)
})

test('balance due date = check-in minus the lead when it is in the future', () => {
  const r = computeDepositPreview({ ...base, bookingTotal: 1000, depositType: 'percent', depositValue: 50, balanceDueDaysBeforeCheckin: 14 })
  // 1 Dec 2026 - 14d = 17 Nov 2026
  assert.equal(r.balanceDueDate.getFullYear(), 2026)
  assert.equal(r.balanceDueDate.getMonth(), 10) // November (0-indexed)
  assert.equal(r.balanceDueDate.getDate(), 17)
})

test('balance due date clamps to today when the lead runs past it', () => {
  const soon = new Date(2026, 7, 12) // 12 Aug 2026, 3 days out
  const r = computeDepositPreview({ ...base, bookingTotal: 1000, depositType: 'percent', depositValue: 50, balanceDueDaysBeforeCheckin: 30, checkIn: soon })
  // 12 Aug - 30d = 13 Jul (past) -> clamp up to today (9 Aug)
  assert.equal(r.balanceDueDate.getMonth(), 7) // August
  assert.equal(r.balanceDueDate.getDate(), 9)
})
