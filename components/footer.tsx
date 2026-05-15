'use client'

import { useState } from 'react'
import Link from 'next/link'

const JLMLogo = ({ variant = 'terracotta', className = '' }: { variant?: 'terracotta' | 'black', className?: string }) => {
  const src = variant === 'black' 
    ? '/logos/JLM_Collective_Horizontal_Black_Transparent.png'
    : '/logos/JLM_Collective_Primary_Horizontal_Terracotta_Transparent.png'
  
  return (
    <img 
      src={src} 
      alt="JLM Collective" 
      className={className}
    />
  )
}

function PrivacyPopup({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 transform">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-stone-900">Privacy Policy</h2>
              <p className="mt-1 text-xs text-stone-500">Last updated: 15 May 2026</p>
            </div>
            <button 
              onClick={onClose}
              className="rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Summary Content */}
          <div className="mb-5 max-h-[50vh] overflow-y-auto pr-2 text-sm leading-relaxed text-stone-600">
            <p className="mb-3">
              JLM Collective Ltd (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates jlmcollective.co and related services. We are committed to protecting your privacy.
            </p>
            
            <p className="mb-3 font-semibold text-stone-800">Key points:</p>
            <ul className="mb-3 list-inside list-disc space-y-1.5 text-stone-600">
              <li>We collect information you provide and usage data</li>
              <li>Your data helps us operate and improve our services</li>
              <li>We do not sell your personal information</li>
              <li>We use industry-standard security measures</li>
              <li>You can request access, correction, or deletion of your data</li>
              <li>We use cookies to enhance your experience</li>
            </ul>

            <p className="text-stone-500">
              For complete details on how we handle your information, please read our full privacy policy.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 border-t border-stone-100 pt-4">
            <button
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-100"
            >
              Close
            </button>
            <Link
              href="/privacy"
              onClick={onClose}
              className="rounded-full bg-[#c76f55] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#b55f47]"
            >
              Read full policy
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

export function Footer() {
  const [showPrivacy, setShowPrivacy] = useState(false)

  return (
    <>
      <footer className="border-t border-stone-200 bg-[#F8F5F2]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-5 py-5 sm:flex-row sm:items-center md:px-6">
          <Link href="/" aria-label="JLM Collective home" className="shrink-0">
            <JLMLogo variant="black" className="h-10 w-auto md:h-12" />
          </Link>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-semibold sm:justify-end">
            <Link href="/become-a-host" className="text-stone-600 transition hover:text-[#c76f55]">List your stay</Link>
            <Link href="/host/login" className="text-stone-600 transition hover:text-[#c76f55]">Host login</Link>
            <Link href="/become-a-host" className="text-stone-600 transition hover:text-[#c76f55]">Trust & safety</Link>
            <Link href="/become-a-host" className="text-stone-600 transition hover:text-[#c76f55]">Contact</Link>
            <button 
              onClick={() => setShowPrivacy(true)}
              className="text-stone-600 transition hover:text-[#c76f55]"
            >
              Privacy Policy
            </button>
          </nav>
        </div>
      </footer>

      <PrivacyPopup isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </>
  )
}
