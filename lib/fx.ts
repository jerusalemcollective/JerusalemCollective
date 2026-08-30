// Live foreign-exchange rates (USD base), used to show listing prices in each
// guest's preferred currency. Fetched from a free, no-key provider and cached
// by Next's fetch cache so we hit it at most a few times a day. If the provider
// is unreachable we fall back to the last good rates, then a static table, so
// price rendering never crashes.

const FX_ENDPOINT = 'https://open.er-api.com/v6/latest/USD'
const REVALIDATE_SECONDS = 21_600 // 6 hours

export type FxRates = Record<string, number>

// USD-based approximate fallback if the provider is down and we have no cache.
// Only used when both the live provider and the last-good cache are unavailable.
const FALLBACK_RATES: FxRates = {
  USD: 1,
  ILS: 3.7,
  GBP: 0.79,
  EUR: 0.92,
  CAD: 1.36,
  CHF: 0.88,
  AUD: 1.52,
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

// Snapshot the host's single price into the legacy price_usd / price_ils columns
// so the existing booking, deposit, display, and search code keeps working while
// the host prices in any currency. getFxRates never throws (live → cache →
// static fallback), so this always resolves.
export async function toLegacyPrices(
  price: number | null,
  currency: string | null,
): Promise<{ price_usd: number | null; price_ils: number | null }> {
  if (!price || !currency) return { price_usd: null, price_ils: null }
  const rates = await getFxRates()
  return {
    price_usd: Math.round(convert(price, currency, 'USD', rates)),
    price_ils: Math.round(convert(price, currency, 'ILS', rates)),
  }
}
