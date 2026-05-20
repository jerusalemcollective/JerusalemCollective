'use client'

import { useState } from 'react'

export function CopyCalendarUrlButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}
