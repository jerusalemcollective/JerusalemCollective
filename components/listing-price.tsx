'use client'

import { useCurrency } from '@/components/currency-provider'
import { convert } from '@/lib/fx'
import { formatMoney } from '@/lib/currencies'

// Shows a listing's nightly price in the guest's preferred currency (converted
// from the stored USD or ILS price with live FX). Until rates load it renders
// the server-provided fallback string so there's no flash of empty price and
// no-JS/SEO still sees a value.
export function ListingPrice({
  priceUsd,
  priceIls,
  fallback,
}: {
  priceUsd: number | null
  priceIls: number | null
  fallback: string
}) {
  const { currency, rates, ready } = useCurrency()

  if (!ready) return <>{fallback}</>

  if (priceUsd != null) return <>{formatMoney(convert(priceUsd, 'USD', currency, rates), currency)}</>
  if (priceIls != null) return <>{formatMoney(convert(priceIls, 'ILS', currency, rates), currency)}</>
  return <>{fallback}</>
}
