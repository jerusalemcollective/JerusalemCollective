// Live foreign-exchange rates (USD base), used to show listing prices in each
// guest's preferred currency. Fetched from a free, no-key provider and cached
// by Next's fetch cache so we hit it at most a few times a day. If the provider
// is unreachable we fall back to the last good rates, then a static table, so
// price rendering never crashes.

const FX_ENDPOINT = 'https://open.er-api.com/v6/latest/USD'
const REVALIDATE_SECONDS = 21_600 // 6 hours

export type FxRates = Record<string, number>

// USD-based approximate fallback if the provider is down and we have no cache.
const FALLBACK_RATES: FxRates = {
  USD: 1,
  ILS: 3.7,
  GBP: 0.79,
  EUR: 0.92,
}

let lastGoodRates: FxRates | null = null

export async function getFxRates(): Promise<FxRates> {
  try {
    const response = await fetch(FX_ENDPOINT, { next: { revalidate: REVALIDATE_SECONDS } })
    if (!response.ok) throw new Error(`FX provider returned ${response.status}`)
    const data = (await response.json()) as { result?: string; rates?: FxRates }
    if (data.result === 'success' && data.rates && data.rates.USD) {
      lastGoodRates = data.rates
      return data.rates
    }
    throw new Error('FX provider returned no rates')
  } catch {
    return lastGoodRates ?? FALLBACK_RATES
  }
}

// Convert an amount between two currencies given USD-based rates
// (rate[c] = how many units of c per 1 USD).
export function convert(amount: number, from: string, to: string, rates: FxRates): number {
  if (from === to) return amount
  const fromRate = rates[from] ?? 1
  const toRate = rates[to] ?? 1
  if (!fromRate) return amount
  return (amount / fromRate) * toRate
}
