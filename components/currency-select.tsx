'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CURRENCIES, currencyName } from '@/lib/currencies'

// Type-ahead currency picker: filters the list as you write and commits an
// ISO code. Used for the guest's preferred display currency.
export function CurrencySelect({
  value,
  onChange,
  id,
}: {
  value: string
  onChange: (code: string) => void
  id?: string
}) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return CURRENCIES
    return CURRENCIES.filter(
      (currency) =>
        currency.code.toLowerCase().includes(term) || currency.name.toLowerCase().includes(term),
    )
  }, [query])

  // When closed, show the committed selection; when typing, show the query.
  const displayValue = isOpen ? query : `${value} · ${currencyName(value)}`

  const commit = (code: string) => {
    onChange(code)
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        value={displayValue}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => {
          setQuery('')
          setIsOpen(true)
        }}
        placeholder="Start typing a currency…"
        className="h-10 w-full rounded-xl border border-stone-200 bg-[#F8F5F2] px-4 text-sm text-stone-900 outline-none focus:border-[#c76f55]"
      />

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
        >
          {results.length === 0 ? (
            <p className="px-4 py-2 text-sm text-stone-500">No matches</p>
          ) : (
            results.map((currency) => (
              <button
                key={currency.code}
                type="button"
                role="option"
                aria-selected={currency.code === value}
                onClick={() => commit(currency.code)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition hover:bg-stone-50 ${
                  currency.code === value ? 'text-[#c76f55]' : 'text-stone-700'
                }`}
              >
                <span className="font-medium">{currency.code}</span>
                <span className="truncate text-stone-500">{currency.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
