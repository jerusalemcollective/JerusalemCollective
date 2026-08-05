import { NextResponse } from 'next/server'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

type NominatimResult = {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

function cleanAddressLabel(label: string) {
  const cleaned = label
    // Remove Hebrew "Israel" (ישראל)
    .replace(/,\s*\u05D9\u05E9\u05E8\u05D0\u05DC/g, ', Israel')
    // Remove Arabic "Israel" (إسرائيل)
    .replace(/,\s*\u0625\u0633\u0631\u0627\u0626\u064A\u0644/g, ', Israel')
    // Remove Hebrew "Jerusalem" (ירושלים)
    .replace(/,\s*\u05D9\u05E8\u05D5\u05E9\u05DC\u05D9\u05DD/g, ', Jerusalem')
    // Remove Arabic "Jerusalem" (القدس)
    .replace(/,\s*\u0627\u0644\u0642\u062F\u0633/g, ', Jerusalem')
    // Remove Hebrew "Jerusalem District" (מחוז ירושלים)
    .replace(/,\s*\u05DE\u05D7\u05D5\u05D6\s\u05D9\u05E8\u05D5\u05E9\u05DC\u05D9\u05DD/g, ', Jerusalem District')
    // Remove Arabic "Jerusalem District" (منطقة القدس)
    .replace(/,\s*\u0645\u0646\u0637\u0642\u0629\s\u0627\u0644\u0642\u062F\u0633/g, ', Jerusalem District')
    .replace(/\s+/g, ' ')
    .trim()

  const parts = cleaned
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !['Israel', 'Jerusalem District'].includes(part))

  const dedupedParts = parts.filter(
    (part, index) => parts.indexOf(part) === index
  )
  const hasJerusalem = dedupedParts.some(
    (part) => part.toLowerCase() === 'jerusalem'
  )
  const shortenedParts = dedupedParts.slice(0, hasJerusalem ? 3 : 2)

  if (!hasJerusalem) shortenedParts.push('Jerusalem')

  return shortenedParts.join(', ')
}

export async function GET(request: Request) {
  if (!rateLimit(`address-suggestions:${getClientIp(request)}`, 120, 60_000)) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

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
    nominatimUrl.searchParams.set('accept-language', 'en')

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'JLM Collective address lookup (https://jlmcollective.co)',
        'Accept-Language': 'en',
      },
      next: { revalidate: 60 * 60 * 24 },
    })

    if (!response.ok) {
      return NextResponse.json({ suggestions: [] })
    }

    const results = (await response.json()) as NominatimResult[]
    const suggestions = results.map((result) => ({
      id: String(result.place_id),
      label: cleanAddressLabel(result.display_name),
      latitude: Number(result.lat),
      longitude: Number(result.lon),
    }))

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Backup address lookup failed:', error)
    return NextResponse.json({ suggestions: [] })
  }
}

