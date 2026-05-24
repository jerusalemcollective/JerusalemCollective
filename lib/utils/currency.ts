type PriceInput = {
  price_ils?: number | null
  price_usd?: number | null
}

export function formatCurrencyAmount(currency: 'ILS' | 'USD', value: number): string {
  const symbol = currency === 'ILS' ? '\u20aa' : '$'
  return `${symbol}${Number(value).toLocaleString()}`
}

export function formatDualCurrencyPrice(listing: PriceInput, fallback = 'Price on request'): string {
  const prices = []

  if (listing.price_ils) {
    prices.push(formatCurrencyAmount('ILS', listing.price_ils))
  }

  if (listing.price_usd) {
    prices.push(formatCurrencyAmount('USD', listing.price_usd))
  }

  return prices.length > 0 ? prices.join(' / ') : fallback
}

export function formatPreferredNightlyPrice(listing: PriceInput, fallback = 'Price on request'): string {
  if (listing.price_usd) return formatCurrencyAmount('USD', listing.price_usd)
  if (listing.price_ils) return formatCurrencyAmount('ILS', listing.price_ils)
  return fallback
}
