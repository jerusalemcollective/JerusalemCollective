'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText } from 'lucide-react'

// Matches the autosave key in app/become-a-host/page.tsx. The draft is a
// browser-only JSON blob (no photos/docs) cleared on a successful submit.
const listingDraftStorageKey = 'jlm-listing-draft-v1'

type DraftPreview = {
  title: string
  area: string | null
  savedLabel: string | null
}

export function DraftListingCard() {
  const [draft, setDraft] = useState<DraftPreview | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(listingDraftStorageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        const title = typeof parsed.apartment_title === 'string' ? parsed.apartment_title.trim() : ''
        const area = typeof parsed.area === 'string' ? parsed.area.trim() : ''
        const step = typeof parsed.step === 'number' ? parsed.step : 0

        // Ignore an empty autosave from someone who opened the form and left.
        if (title || area || step > 0) {
          let savedLabel: string | null = null
          if (typeof parsed.saved_at === 'string') {
            const date = new Date(parsed.saved_at)
            if (!Number.isNaN(date.getTime())) {
              savedLabel = date.toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            }
          }
          setDraft({ title: title || 'Untitled stay', area: area || null, savedLabel })
        }
      }
    } catch {
      // Malformed draft — treat as no draft.
    }
    setReady(true)
  }, [])

  if (!ready || !draft) return null

  const meta = [draft.area, 'Draft', draft.savedLabel ? `saved ${draft.savedLabel}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="border-b border-stone-200 py-6">
      <h2 className="text-xl font-bold text-stone-950">Drafts</h2>
      <div className="mt-4 flex flex-col gap-4 rounded-3xl border border-[#c76f55]/30 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff4ef]">
            <FileText className="h-5 w-5 text-[#c76f55]" />
          </div>
          <div>
            <p className="font-bold text-stone-950">{draft.title}</p>
            <p className="mt-0.5 text-sm text-stone-500">{meta}</p>
          </div>
        </div>
        <Link
          href="/become-a-host"
          className="inline-flex w-fit shrink-0 items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
        >
          Continue
        </Link>
      </div>
    </section>
  )
}
