import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { allNeighborhoods } from '@/lib/neighborhoods'

type NeighborhoodSearchBody = {
  neighborhood?: string
  source?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as NeighborhoodSearchBody
    const neighborhood = body.neighborhood?.trim()

    if (!neighborhood || neighborhood === 'All') {
      return NextResponse.json({ ok: true })
    }

    const canonicalNeighborhood = allNeighborhoods.find(
      (item) => item.toLowerCase() === neighborhood.toLowerCase(),
    )

    if (!canonicalNeighborhood) {
      return NextResponse.json({ ok: true })
    }

    const supabase = await createClient()
    await supabase.rpc('record_neighborhood_search', {
      searched_neighborhood: canonicalNeighborhood,
      search_source: body.source || 'stays_filter',
    })
  } catch (error) {
    console.error('Unable to record neighborhood search', error)
  }

  return NextResponse.json({ ok: true })
}
