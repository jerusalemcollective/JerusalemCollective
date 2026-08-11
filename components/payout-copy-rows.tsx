'use client'

import { useState } from 'react'

// Copyable payout rows for the trips page. A live copy button only works on the web —
// email clients strip the JavaScript — so this is where a guest actually one-tap-copies
// the host's IBAN / account number / SWIFT to make the payment.
export function PayoutCopyRows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="mt-1 space-y-1">
      {rows.map(([label, value]) => (
        <PayoutCopyRow key={label} label={label} value={value} />
      ))}
    </div>
  )
}

function PayoutCopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked/unavailable — the value is still on screen to select by hand.
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4">
      <span className="text-stone-500">{label}</span>
      <button
        type="button"
        onClick={copy}
        className="group inline-flex items-center gap-1.5 text-left font-medium text-stone-800 transition hover:text-[#c76f55]"
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
      >
        <span>{value}</span>
        {copied ? (
          <span className="text-xs font-semibold text-green-600">Copied</span>
        ) : (
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0 text-stone-400 transition group-hover:text-[#c76f55]"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  )
}
