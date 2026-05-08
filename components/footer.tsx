import Link from 'next/link'

const JLMLogo = ({ variant = 'terracotta', className = '' }) => {
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

export function Footer() {
  return (
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
        </nav>
      </div>
    </footer>
  )
}
