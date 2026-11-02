'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { useListingDraft } from '@/components/draft-listing-card'

const dismissKey = 'jlm-complete-listing-banner-dismissed'

// A slim reminder under the header when this browser holds an unfinished
// listing from /become-a-host. Hidden on the form itself, in the dashboards
// (the host dashboard has its own Drafts card) and once dismissed this visit.
export function CompleteListingBanner() {
  const pathname = usePathname()
  const draft = useListingDraft()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.sessionStorage.getItem(dismissKey) === '1'
    } catch {
      return false
    }
  })

  const hiddenHere = ['/become-a-host', '/admin', '/host'].some((path) => pathname?.startsWith(path))
  if (!draft || dismissed || hiddenHere) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      window.sessionStorage.setItem(dismissKey, '1')
    } catch {
      // Storage unavailable: hidden until the next page load.
    }
  }

  return (
    <div className="border-b border-[#c76f55]/20 bg-[#fff4ef]">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 text-sm sm:px-6 lg:px-8">
        <p className="min-w-0 flex-1 text-stone-800">
          <span className="font-semibold">Your listing isn&apos;t finished yet.</span>{' '}
          <span className="text-stone-600">
            {draft.title !== 'Untitled stay' ? `"${draft.title}" is saved as a draft.` : 'We saved your progress.'}
          </span>
        </p>
        <Link
          href="/become-a-host"
          className="shrink-0 rounded-full bg-stone-950 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-stone-800"
        >
          Complete your listing
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide this reminder"
          className="shrink-0 rounded-full p-1 text-stone-500 transition hover:bg-white hover:text-stone-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
