'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function parseLocalDate(value: string | null) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function getFocusable(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getClientRects().length > 0,
  )
}

// Below md the homepage search collapses to one slim "Search stays" pill. Tapping
// it opens the same form (rendered once — it is just restyled) as a bottom sheet.
// From md up the form sits inline and the pill is hidden.
export function MobileSearchSheet({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const pillRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const area = searchParams.get('neighborhood') || searchParams.get('area')
  const checkIn = parseLocalDate(searchParams.get('checkIn'))
  const checkOut = parseLocalDate(searchParams.get('checkOut'))
  const guests = Number(searchParams.get('guests')) || 0
  const summary = [
    area && area !== 'All' ? area : 'Any area',
    checkIn
      ? checkOut
        ? `${formatShortDate(checkIn)} – ${formatShortDate(checkOut)}`
        : formatShortDate(checkIn)
      : 'Any dates',
    guests > 0 ? `${guests}${guests >= 10 ? '+' : ''} guest${guests === 1 ? '' : 's'}` : 'Guests',
  ].join(' · ')

  const close = useCallback(() => {
    setOpen(false)
    // Wait for the sheet to collapse before handing focus back to the pill.
    requestAnimationFrame(() => pillRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!open) return
    const sheet = sheetRef.current
    if (!sheet) return

    // Move focus to the first field of the form (skipping the close button).
    const firstField = getFocusable(sheet).find(
      (element) => !element.hasAttribute('data-sheet-close'),
    )
    firstField?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      // A date picker or filters dialog opened from inside the form handles its
      // own Escape and Tab; leave those keys to it while it is open.
      const nestedDialog = sheet.querySelector<HTMLElement>('[role="dialog"]')

      if (event.key === 'Escape') {
        if (nestedDialog) return
        event.preventDefault()
        close()
        return
      }

      if (event.key !== 'Tab') return
      const container = nestedDialog ?? sheet
      const focusable = getFocusable(container)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    // The sheet only exists below md; if the window grows past it, fall back to
    // the inline form.
    const desktop = window.matchMedia('(min-width: 768px)')
    const handleViewportChange = () => {
      if (desktop.matches) setOpen(false)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    desktop.addEventListener('change', handleViewportChange)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      desktop.removeEventListener('change', handleViewportChange)
    }
  }, [open, close])

  return (
    <>
      <button
        ref={pillRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-full border border-stone-200 bg-white py-2 pl-5 pr-2 text-left shadow-sm transition hover:border-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 md:hidden"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-stone-950">Search stays</span>
          <span className="block truncate text-xs text-stone-500">{summary}</span>
        </span>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c76f55] text-white">
          <Search className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div
          role="presentation"
          onClick={close}
          className="fixed inset-0 z-50 bg-black/45 md:hidden"
        />
      )}

      <div
        ref={sheetRef}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-labelledby={open ? 'mobile-search-sheet-title' : undefined}
        className={
          open
            ? 'fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-[#F8F5F2] px-3 pb-4 pt-3 text-left shadow-xl md:static md:z-auto md:max-h-none md:overflow-visible md:rounded-none md:bg-transparent md:p-0 md:shadow-none'
            : 'hidden md:block'
        }
      >
        {open && (
          <div className="mb-3 flex items-center justify-between gap-3 px-2 md:hidden">
            <h2 id="mobile-search-sheet-title" className="text-base font-semibold text-stone-950">
              Search stays
            </h2>
            <button
              type="button"
              onClick={close}
              data-sheet-close
              aria-label="Close search"
              className="rounded-full p-1.5 text-stone-500 transition hover:bg-stone-200/60 hover:text-stone-900"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}
        {children}
      </div>
    </>
  )
}
