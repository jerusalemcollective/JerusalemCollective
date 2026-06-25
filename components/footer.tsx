import Link from 'next/link'

const JLMLogo = ({ variant = 'terracotta', className = '' }: { variant?: 'terracotta' | 'black', className?: string }) => {
  const src = variant === 'black' 
    ? '/logos/JLM_Collective_Horizontal_Black_UI.webp'
    : '/logos/JLM_Collective_Primary_Horizontal_Terracotta_UI.webp'
  
  return (
    <img 
      src={src} 
      alt="JLM Collective" 
      className={className}
    />
  )
}

export function Footer() {
  return (
    <>
      <footer className="border-t border-stone-200 bg-[#F8F5F2]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-5 py-5 sm:flex-row sm:items-center md:px-6">
          <div className="max-w-sm">
            <Link href="/" aria-label="JLM Collective home" className="inline-flex shrink-0">
              <JLMLogo variant="black" className="h-10 w-auto md:h-12" />
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-stone-500">
              JLM Collective is a specialist Jerusalem letting agency. We market and let verified Jerusalem properties on behalf of property owners.
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-semibold sm:justify-end">
            <Link href="/how-it-works" className="text-stone-600 transition hover:text-[#c76f55]">How it works</Link>
            <Link href="/stays" className="text-stone-600 transition hover:text-[#c76f55]">Browse stays</Link>
            <Link href="/explore" className="text-stone-600 transition hover:text-[#c76f55]">Explore</Link>
            <Link href="/host/login" className="text-stone-600 transition hover:text-[#c76f55]">Host login</Link>
            <Link href="/trust-and-safety" className="text-stone-600 transition hover:text-[#c76f55]">
              Trust & Safety
            </Link>
            <a href="mailto:info@jlmcollective.co" className="text-stone-600 transition hover:text-[#c76f55]">Contact</a>
            <Link href="/privacy" className="text-stone-600 transition hover:text-[#c76f55]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-stone-600 transition hover:text-[#c76f55]">Terms</Link>
          </nav>
        </div>
      </footer>
    </>
  )
}
