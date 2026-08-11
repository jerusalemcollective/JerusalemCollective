'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { normalizeCurrency } from '@/lib/currencies'
import type { FxRates } from '@/lib/fx'

type CurrencyContextValue = {
  currency: string
  rates: FxRates
  // false until FX rates (and the signed-in guest's preference) have loaded, so
  // price components can show a server-provided fallback until then.
  ready: boolean
}

const CurrencyContext = createContext<CurrencyContextValue>({ currency: 'USD', rates: {}, ready: false })

export function useCurrency() {
  return useContext(CurrencyContext)
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState('USD')
  const [rates, setRates] = useState<FxRates>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    const loadPreferredCurrency = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return null
        const { data } = await supabase
          .from('profiles')
          .select('preferred_currency')
          .eq('id', user.id)
          .maybeSingle()
        return data?.preferred_currency ?? null
      } catch {
        return null
      }
    }

    Promise.all([
      fetch('/api/fx')
        .then((response) => response.json())
        .catch(() => null),
      loadPreferredCurrency(),
    ]).then(([fx, preferred]) => {
      if (!active) return
      if (fx?.rates) setRates(fx.rates as FxRates)
      if (preferred) setCurrency(normalizeCurrency(preferred))
      setReady(true)
    })

    return () => {
      active = false
    }
  }, [])

  return <CurrencyContext.Provider value={{ currency, rates, ready }}>{children}</CurrencyContext.Provider>
}
