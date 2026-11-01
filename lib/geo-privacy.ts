// Public pages must not reveal where a listing's building is. Coordinates sent
// to the browser (map pins on /stays and /map) are snapped to a fixed grid of
// 0.005 degrees: about 555 m north-south and 470 m east-west in Jerusalem, so a
// pin is at most roughly 300 m from the real spot and every listing in the same
// cell shares one pin. Snapping (not random jitter) means reloading the page
// can't be averaged to recover the real point.
//
// The precise values stay in the database for server-side work such as shul
// distances. Use this only on values that leave the server.

export const PUBLIC_COORDINATE_GRID_DEGREES = 0.005

export function approximateCoordinate(value: number): number
export function approximateCoordinate(value: number | null | undefined): number | null
export function approximateCoordinate(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const snapped = Math.round(value / PUBLIC_COORDINATE_GRID_DEGREES) * PUBLIC_COORDINATE_GRID_DEGREES
  // toFixed strips float noise such as 31.775000000000002.
  return Number(snapped.toFixed(3))
}
