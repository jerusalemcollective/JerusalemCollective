import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { allNeighborhoods } from '@/lib/neighborhoods'

const areaRowSchema = z.object({ area: z.string().nullable() })

// The `listings.area` values that have at least one published listing, using
// the same is_published condition as the public listing queries. Returns null
// when the read fails so callers fall back to showing every area.
export async function getLiveAreaSet(supabase: SupabaseClient): Promise<Set<string> | null> {
  try {
    const { data, error } = await supabase.from('listings').select('area').eq('is_published', true)
    if (error) return null
    const areas = z.array(areaRowSchema).parse(data ?? [])
      .map((row) => row.area)
      .filter((area): area is string => Boolean(area))
    return new Set(areas)
  } catch {
    return null
  }
}

// Keeps only the areas guests can actually book, in the given order. With no
// live set (failed read) the list is returned unchanged.
export function filterLiveAreas(areas: string[], liveAreas: Set<string> | null): string[] {
  if (!liveAreas) return areas
  return areas.filter((area) => liveAreas.has(area))
}

// Area chips / "More areas" list: the curated neighbourhood list, minus areas
// with no published stays.
export async function getLiveNeighborhoods(supabase: SupabaseClient): Promise<string[]> {
  return filterLiveAreas(allNeighborhoods, await getLiveAreaSet(supabase))
}

// Featured chips: the preferred areas that are live, topped up with other live
// areas so the row stays full when a popular area has nothing listed.
export function pickFeaturedAreas(preferred: string[], liveNeighborhoods: string[], limit: number) {
  return [...preferred.filter((area) => liveNeighborhoods.includes(area)), ...liveNeighborhoods]
    .filter((area, index, areas) => areas.indexOf(area) === index)
    .slice(0, limit)
}
