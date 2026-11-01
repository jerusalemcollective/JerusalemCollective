// Guards for the public map coordinate rounding.
// Run: `node --test tests/geo-privacy.test.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { approximateCoordinate, PUBLIC_COORDINATE_GRID_DEGREES } from '../lib/geo-privacy.ts'

test('snaps to the 0.005 degree grid', () => {
  assert.equal(approximateCoordinate(31.77634), 31.775)
  assert.equal(approximateCoordinate(35.21371), 35.215)
  assert.equal(approximateCoordinate(31.7683), 31.77)
})

test('never moves a point more than half a grid step', () => {
  for (let value = 31.7; value < 31.85; value += 0.000137) {
    const rounded = approximateCoordinate(value)
    assert.ok(Math.abs(rounded - value) <= PUBLIC_COORDINATE_GRID_DEGREES / 2 + 1e-9)
  }
})

test('nearby buildings in one cell share a pin', () => {
  assert.equal(approximateCoordinate(31.7761), approximateCoordinate(31.7768))
})

test('passes through missing values as null', () => {
  assert.equal(approximateCoordinate(null), null)
  assert.equal(approximateCoordinate(undefined), null)
  assert.equal(approximateCoordinate(Number.NaN), null)
})
