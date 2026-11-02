'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchServerDraft, LISTING_DRAFT_CHANGED_EVENT } from '@/lib/listing-draft-server'

// Matches the autosave key in app/become-a-host/page.tsx. The browser draft is
// a JSON blob (photos live in IndexedDB) cleared on a successful submit. A
// signed-in host also has a server copy (public.listing_drafts) so the draft
// shows up on any device; the newer of the two wins.
const listingDraftStorageKey = 'jlm-listing-draft-v1'

type DraftPreview = {
  title: string
  area: string | null
  savedLabel: string | null
}

type DraftSummary = {
  title: string
  area: string
  step: number
  savedAt: string | null
}

function readLocalDraft(): DraftSummary | null {
  try {
    const raw = window.localStorage.getItem(listingDraftStorageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      title: typeof parsed.apartment_title === 'string' ? parsed.apartment_title.trim() : '',
      area: typeof parsed.area === 'string' ? parsed.area.trim() : '',
      step: typeof parsed.step === 'number' ? parsed.step : 0,
      savedAt: typeof parsed.saved_at === 'string' ? parsed.saved_at : null,
    }
  } catch {
    // Malformed draft — treat as no draft.
    return null
  }
}

// One request per page load, shared by the header, banner and dashboard card.
let serverDraftPromise: Promise<DraftSummary | null> | null = null

function loadServerDraft(): Promise<DraftSummary | null> {
  if (!serverDraftPromise) {
    serverDraftPromise = (async () => {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const userId = session?.user?.id
        if (!userId) return null
        const row = await fetchServerDraft(supabase, userId)
        if (!row) return null
        return {
          title: (row.title || '').trim(),
          area: (row.area || '').trim(),
          step: typeof row.step === 'number' ? row.step : 0,
          savedAt: row.updated_at,
        }
      } catch {
        // Supabase not configured, or signed out — browser draft only.
        return null
      }
    })()
  }
  return serverDraftPromise
}

function savedTime(summary: DraftSummary | null) {
  const time = summary?.savedAt ? new Date(summary.savedAt).getTime() : NaN
  return Number.isNaN(time) ? 0 : time
}

function toPreview(summary: DraftSummary | null): DraftPreview | null {
  // Ignore an empty autosave from someone who opened the form and left.
  if (!summary || !(summary.title || summary.area || summary.step > 0)) return null
  let savedLabel: string | null = null
  const time = savedTime(summary)
  if (time) {
    savedLabel = new Date(time).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  return { title: summary.title || 'Untitled stay', area: summary.area || null, savedLabel }
}

// The in-progress listing from /become-a-host: this browser's draft, or the
// signed-in user's server draft if that one is newer. null until loaded, or
// when there is no meaningful draft.
export function useListingDraft() {
  const [draft, setDraft] = useState<DraftPreview | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const refresh = (refetchServer: boolean) => {
      if (refetchServer) serverDraftPromise = null
      const local = readLocalDraft()
      if (!cancelled) {
        setDraft(toPreview(local))
        setReady(true)
      }
      void loadServerDraft().then((server) => {
        if (cancelled || !server) return
        const localPreview = toPreview(local)
        const serverPreview = toPreview(server)
        if (serverPreview && (!localPreview || savedTime(server) > savedTime(local))) {
          setDraft(serverPreview)
        }
      })
    }

    refresh(false)
    const onChanged = () => refresh(true)
    window.addEventListener(LISTING_DRAFT_CHANGED_EVENT, onChanged)
    return () => {
      cancelled = true
      window.removeEventListener(LISTING_DRAFT_CHANGED_EVENT, onChanged)
    }
  }, [])

  return ready ? draft : null
}

export function DraftListingCard() {
  const draft = useListingDraft()

  if (!draft) return null

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
