'use client'

import Link from 'next/link'

const JLMLogo = ({ variant = 'terracotta', className = '' }) => {
  const src = variant === 'terracotta' 
    ? '/logos/JLM_Collective_Primary_Horizontal_Terracotta_Transparent.png'
    : '/logos/JLM_Collective_Primary_Horizontal_Black_Transparent.png'
  
  return (
    <img 
      src={src} 
      alt="JLM Collective" 
      className={className}
    />
  )
}

const SavedStayIcon = ({ className = '' }) => (
  <img
    src="/icons/yemin-moshe-save.png"
    alt=""
    aria-hidden="true"
    className={`object-contain ${className}`}
  />
)

const UserIcon = ({ className = '' }) => (
  <svg
    className={className}
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 21a8 8 0 0 0-16 0" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#F8F5F2]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-6">
        <Link href="/" className="shrink-0" aria-label="JLM Collective home">
          <JLMLogo variant="terracotta" className="h-10 w-auto md:h-12" />
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold lg:flex">
          <Link href="/stays" className="text-stone-600 transition hover:text-[#c76f55]">
            Explore
          </Link>
          <Link href="/stays" className="text-stone-600 transition hover:text-[#c76f55]">
            Stays
          </Link>
          <Link href="/stays?view=map" className="text-stone-600 transition hover:text-[#c76f55]">
            Map
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/become-a-host"
            className="inline-flex rounded-full bg-[#252525] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#111111] sm:px-4 sm:text-sm md:px-5"
          >
            List your stay
          </Link>

          <Link
            href="/saved"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 shadow-sm transition hover:border-stone-500 hover:bg-stone-50"
            aria-label="Saved stays"
            title="Saved stays"
          >
            <SavedStayIcon className="h-7 w-7" />
          </Link>

          <Link
            href="/host/login"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 shadow-sm transition hover:border-stone-500 hover:bg-stone-50"
            aria-label="Account"
            title="Account"
          >
            <UserIcon className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  )
}
