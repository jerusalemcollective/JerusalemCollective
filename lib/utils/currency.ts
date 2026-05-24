type PriceInput = {
  price_ils?: number | null
  price_usd?: number | null
}

export function formatPrice(
  value?: number | null,
): string | null {
  return value
    ? value.toLocaleString()
    : null
}

export function formatCurrencyAmount(currency: 'ILS' | 'USD', value: number): string {
  const symbol = currency === 'ILS' ? '\u20aa' : '$'
  return `${symbol}${Number(value).toLocaleString()}`
}

export function formatListingPrice(listing: PriceInput): string {
  const ils = listing.price_ils
    ? listing.price_ils.toLocaleString()
    : null
  const usd = listing.price_usd
    ? listing.price_usd.toLocaleString()
    : null
  if (ils && usd) return `\u20aa${ils} / $${usd}`
  if (ils) return `\u20aa${ils}`
  if (usd) return `$${usd}`
  return 'Price on request'
}

export function formatPricePerNight(
  listing: PriceInput,
): string {
  const base = formatListingPrice(listing)
  if (base === 'Price on request') return base
  return `${base} / night`
}

export function formatDualCurrencyPrice(listing: PriceInput, fallback = 'Price on request'): string {
  const price = formatListingPrice(listing)
  return price === 'Price on request' ? fallback : price
}

export function formatPreferredNightlyPrice(listing: PriceInput, fallback = 'Price on request'): string {
  if (listing.price_usd) return formatCurrencyAmount('USD', listing.price_usd)
  if (listing.price_ils) return formatCurrencyAmount('ILS', listing.price_ils)
  return fallback
}
