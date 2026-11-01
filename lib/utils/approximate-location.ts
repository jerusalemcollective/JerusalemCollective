// Guests only ever see the area a stay is in, never the building. The listing
// page snaps the stored coordinates to a coarse grid on the server, so the
// precise latitude/longitude never reach the browser (props, JSON-LD or map).
//
// A 0.005° grid is about 555 m north-south and about 475 m east-west in
// Jerusalem, so the snapped point is at most about 365 m from the real one.
// That keeps the real address inside the 500 m area circle on the map while
// many nearby buildings share the same snapped point.
export const APPROXIMATE_GRID_DEGREES = 0.005

// Radius of the "approximate area" circle drawn on the map, in metres.
export const APPROXIMATE_AREA_RADIUS_METRES = 500

export function approximateCoordinate(value: number): number
export function approximateCoordinate(value: number | null): number | null
export function approximateCoordinate(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null
  const snapped = Math.round(value / APPROXIMATE_GRID_DEGREES) * APPROXIMATE_GRID_DEGREES
  // Trim float noise (31.775000000000002) so the value is clean in JSON.
  return Number(snapped.toFixed(3))
}
