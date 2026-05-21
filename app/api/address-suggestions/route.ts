import { NextResponse } from 'next/server'

type NominatimResult = {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()

  if (!query || query.length < 3) {
    return NextResponse.json({ suggestions: [] })
  }

  try {
    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search')
    nominatimUrl.searchParams.set('format', 'jsonv2')
    nominatimUrl.searchParams.set('q', `${query}, Jerusalem, Israel`)
    nominatimUrl.searchParams.set('countrycodes', 'il')
    nominatimUrl.searchParams.set('limit', '8')
    nominatimUrl.searchParams.set('addressdetails', '0')
    nominatimUrl.searchParams.set('bounded', '1')
    nominatimUrl.searchParams.set('viewbox', '35.10,31.86,35.32,31.68')

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'JLM Collective address lookup (https://jlmcollective.co)',
      },
      next: { revalidate: 60 * 60 * 24 },
    })

    if (!response.ok) {
      return NextResponse.json({ suggestions: [] })
    }

    const results = (await response.json()) as NominatimResult[]
    const suggestions = results.map((result) => ({
      id: String(result.place_id),
      label: result.display_name,
      latitude: Number(result.lat),
      longitude: Number(result.lon),
    }))

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Backup address lookup failed:', error)
    return NextResponse.json({ suggestions: [] })
  }
}
