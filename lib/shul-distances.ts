'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getShulsForNeighbourhood } from '@/lib/constants'

type WalkingResult = {
  shulName: string
  walkingSeconds: number
}

type RouteMatrixRow = {
  originIndex: number
  destinationIndex: number
  duration?: string
  status?: {
    code?: number
    message?: string
  }
  condition?: string
}

function isRouteMatrixRow(value: unknown): value is RouteMatrixRow {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return typeof row.originIndex === 'number' &&
    typeof row.destinationIndex === 'number'
}

function parseRoutesApiRows(value: unknown): RouteMatrixRow[] {
  return Array.isArray(value)
    ? value.filter(isRouteMatrixRow)
    : []
}

function isSuccessfulRoute(row: RouteMatrixRow): boolean {
  return row.condition === 'ROUTE_EXISTS' ||
    row.status?.code === 0 ||
    row.status === undefined
}

export async function calculateShulDistances(
  listingId: string,
  listingLat: number,
  listingLng: number,
  area: string,
): Promise<WalkingResult[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    console.warn(
      'GOOGLE_MAPS_API_KEY not set - skipping shul distance calculation',
    )
    return []
  }

  const shuls = getShulsForNeighbourhood(area)

  if (shuls.length === 0) return []

  const origins = [{
    waypoint: {
      location: {
        latLng: {
          latitude: listingLat,
          longitude: listingLng,
        },
      },
    },
  }]

  const destinations = shuls.map((shul) => ({
    waypoint: {
      location: {
        latLng: {
          latitude: shul.lat,
          longitude: shul.lng,
        },
      },
    },
  }))

  try {
    const response = await fetch(
      'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,status,condition',
        },
        body: JSON.stringify({
          origins,
          destinations,
          travelMode: 'WALK',
          languageCode: 'en-GB',
        }),
      },
    )

    if (!response.ok) {
      console.error(
        'Routes API error:',
        response.status,
        await response.text(),
      )
      return []
    }

    const rows = parseRoutesApiRows(await response.json())
    const results: WalkingResult[] = []

    for (const row of rows) {
      if (
        isSuccessfulRoute(row) &&
        row.duration &&
        row.destinationIndex < shuls.length
      ) {
        const seconds = Number.parseInt(
          row.duration.replace('s', ''),
          10,
        )

        if (Number.isFinite(seconds)) {
          results.push({
            shulName: shuls[row.destinationIndex].name,
            walkingSeconds: seconds,
          })
        }
      }
    }

    return results
  } catch (error) {
    console.error(
      'Failed to calculate shul distances:',
      error,
    )
    return []
  }
}

export async function saveShulDistances(
  supabase: SupabaseClient,
  listingId: string,
  distances: WalkingResult[],
): Promise<void> {
  if (distances.length === 0) return

  const rows = distances.map((distance) => ({
    listing_id: listingId,
    shul_name: distance.shulName,
    walking_seconds: distance.walkingSeconds,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('listing_shul_distances')
    .upsert(rows, {
      onConflict: 'listing_id,shul_name',
    })

  if (error) {
    console.error(
      'Failed to save shul distances:',
      error,
    )
  }
}
