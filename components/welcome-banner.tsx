'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export function WelcomeBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('jlm-welcome-dismissed')
    if (!dismissed) setVisible(true)
  }, [])

  const dismiss = () => {
    localStorage.setItem('jlm-welcome-dismissed', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="mb-6 rounded-3xl border border-[#c76f55]/20 bg-[#fff4ef] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-stone-950">Welcome to JLM Collective</h2>
          <p className="mt-1 text-sm text-stone-600">
            Browse verified Jerusalem stays, send an enquiry, and we will match you with the right property for your visit.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/stays"
              onClick={dismiss}
              className="rounded-full bg-[#c76f55] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#b85f47]"
            >
              Browse stays
            </Link>
            <Link
              href="/stays?neighborhood=Rechavia"
              onClick={dismiss}
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300"
            >
              Popular areas
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-stone-400 transition hover:text-stone-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
