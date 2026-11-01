// Guards the listing-page location privacy: guests get a snapped point, never
// the stored coordinates, and the real spot stays inside the area circle.
// Run: `node --test lib/utils/approximate-location.test.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  APPROXIMATE_AREA_RADIUS_METRES,
  approximateCoordinate,
} from './approximate-location.ts'

function distanceMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

test('snaps to a coarse grid with no float noise', () => {
  assert.equal(approximateCoordinate(31.776712), 31.775)
  assert.equal(approximateCoordinate(35.234512), 35.235)
  assert.equal(approximateCoordinate(31.7726), 31.775)
  assert.equal(approximateCoordinate(31.7724), 31.77)
})

test('keeps null as null', () => {
  assert.equal(approximateCoordinate(null), null)
})

test('nearby buildings share one point, so the exact spot cannot be recovered', () => {
  assert.equal(approximateCoordinate(31.7761), approximateCoordinate(31.7769))
  assert.equal(approximateCoordinate(35.2131), approximateCoordinate(35.2139))
})

test('the real location always sits inside the area circle', () => {
  for (let lat = 31.73; lat < 31.82; lat += 0.0007) {
    for (let lng = 35.18; lng < 35.26; lng += 0.0009) {
      const d = distanceMetres(lat, lng, approximateCoordinate(lat), approximateCoordinate(lng))
      assert.ok(d < APPROXIMATE_AREA_RADIUS_METRES, `${lat},${lng} is ${d}m from its snapped point`)
    }
  }
})
