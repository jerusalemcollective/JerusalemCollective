import Image from 'next/image'

const logoMap = {
  header: '/logos/JLM_Collective_Primary_Horizontal_Terracotta_UI.webp',
  footer: '/logos/JLM_Collective_Horizontal_Black_UI.webp',
  icon: '/logos/JLM_Collective_Icon_Terracotta_Transparent.png',
  wordmarkBlack: '/logos/JLM_Collective_Wordmark_Black_Transparent.png',
}

interface LogoProps {
  variant?: 'header' | 'footer' | 'icon' | 'wordmarkBlack'
  className?: string
  priority?: boolean
}

export default function Logo({
  variant = 'header',
  className = '',
  priority = false,
}: LogoProps) {
  const src = logoMap[variant] || logoMap.header

  return (
    <img
      src={src}
      alt="JLM Collective"
      className={className}
      {...(priority ? { fetchPriority: 'high' } : {})}
    />
  )
}
