import { NextResponse } from 'next/server'
import { getFxRates } from '@/lib/fx'

// Same-origin endpoint so client components can read live FX rates without
// calling the external provider directly (keeps the provider call server-side
// and cached). Rates refresh at most every 6 hours via getFxRates' fetch cache.
export const revalidate = 21_600

export async function GET() {
  const rates = await getFxRates()
  return NextResponse.json({ rates })
}
