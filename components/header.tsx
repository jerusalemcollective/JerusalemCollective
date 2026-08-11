'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const JLMLogo = ({ variant = 'terracotta', className = '' }) => {
  const src = variant === 'terracotta' 
    ? '/logos/JLM_Collective_Primary_Horizontal_Terracotta_UI.webp'
    : '/logos/JLM_Collective_Horizontal_Black_UI.webp'
  
  return (
    <Image
      src={src}
      alt="JLM Collective"
      width={512}
      height={128}
      priority
      className={className}
    />
  )
}

const SavedStayIcon = ({ className = '' }: { className?: string }) => (
  <Image
    src="/icons/yemin-moshe-save-ui.webp"
    alt=""
    aria-hidden="true"
    width={96}
    height={96}
    className={`rounded-full object-cover ${className}`}
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

type UserState = {
  id: string
  email: string | undefined
  avatarUrl: string | null
  fullName: string | null
  hasStay: boolean
  isAdmin: boolean
} | null

export function Header({
  servicesBarEnabled = true,
}: {
  servicesBarEnabled?: boolean
}) {
  const [user, setUser] = useState<UserState>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const accountButtonRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    const loadUser = async () => {
      try {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        
        if (authUser) {
          const [{ data: profile }, { data: host }] = await Promise.all([
            supabase
              .from('profiles')
              .select('full_name, avatar_url, is_host, is_admin')
              .eq('id', authUser.id)
              .single(),
            supabase
              .from('hosts')
              .select('id')
              .or(`id.eq.${authUser.id},user_id.eq.${authUser.id}`)
              .limit(1)
              .maybeSingle(),
          ])

          const hostIds = Array.from(new Set([host?.id, authUser.id].filter(Boolean))) as string[]
          const [{ data: ownedApplication }, { data: ownedListing }] = await Promise.all([
            supabase
              .from('host_applications')
              .select('id')
              .in('host_id', hostIds)
              .limit(1)
              .maybeSingle(),
            supabase
              .from('listings')
              .select('id')
              .in('host_id', hostIds)
              .limit(1)
              .maybeSingle(),
          ])

          const nextUser = {
            id: authUser.id,
            email: authUser.email,
            avatarUrl: profile?.avatar_url || null,
            fullName: profile?.full_name || null,
            hasStay: Boolean(host || ownedApplication || ownedListing),
            isAdmin: profile?.is_admin || false,
          }

          setUser(nextUser)
        }
      } catch (error) {
        // User not logged in or error fetching profile
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
    const handleFocus = () => {
      void loadUser()
    }
    const handleMessagesRead = () => {
      void loadUser()
    }
    window.addEventListener('focus', handleFocus)
    window.addEventListener('messages-read', handleMessagesRead)

    // Listen for auth changes
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
      } else if (event === 'SIGNED_IN') {
        loadUser()
      }
    })

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('messages-read', handleMessagesRead)
      subscription.unsubscribe()
    }
  }, [])

  // Close dropdown when clicking outside, or close menus on Escape (with focus return)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setShowDropdown((open) => {
        if (open) accountButtonRef.current?.focus()
        return false
      })
      setMobileOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setShowDropdown(false)
    setMobileOpen(false)
    window.location.href = '/'
  }

  const navLinkClass = (href: string) =>
    `text-stone-600 transition hover:text-[#c76f55] ${
      pathname === href || pathname.startsWith(`${href}/`) ? 'text-[#c76f55]' : ''
    }`

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#F8F5F2]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-6">
        <Link href="/" className="shrink-0" aria-label="JLM Collective home">
          <JLMLogo variant="terracotta" className="h-10 w-auto md:h-12" />
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold lg:flex">
          <Link href="/stays" className={navLinkClass('/stays')}>
            Stays
          </Link>
          <Link href="/explore" className={navLinkClass('/explore')}>
            Explore
          </Link>
          <Link href="/how-it-works" className={navLinkClass('/how-it-works')}>
            How it works
          </Link>
          {servicesBarEnabled && (
            <Link href="/services" className={navLinkClass('/services')}>
              Services
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href={user ? '/become-a-host' : '/login?redirect=/become-a-host'}
            className="hidden rounded-full bg-[#252525] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#111111] sm:inline-flex md:px-5"
          >
            List your stay
          </Link>

          <Link
            href={user ? "/account/saved" : "/login?redirect=/account/saved"}
            className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full transition-transform hover:scale-110 sm:h-10 sm:w-10"
            aria-label="Saved stays"
            title="Saved stays"
          >
            <SavedStayIcon className="h-full w-full" />
          </Link>

          {/* Account Button/Dropdown */}
          <div className="relative" ref={dropdownRef}>
            {isLoading ? (
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white sm:h-10 sm:w-10">
                <div className="h-4 w-4 animate-pulse rounded-full bg-stone-200" />
              </div>
            ) : user ? (
              <>
                <button
                  ref={accountButtonRef}
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-white transition hover:border-stone-400 hover:bg-stone-50 sm:h-10 sm:w-10"
                  aria-label="Account menu"
                  aria-haspopup="menu"
                  aria-expanded={showDropdown}
                  title="Account"
                >
                  {user.avatarUrl ? (
                    // Intentionally a raw <img>: avatar URLs may come from external
                    // OAuth providers not listed in next.config images.remotePatterns,
                    // which would make next/image throw.
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserIcon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                  )}
                </button>

                {showDropdown && (
                  <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
                    {/* User Info */}
                    <div className="border-b border-stone-100 px-4 py-3">
                      <p className="font-semibold text-stone-900">{user.fullName || 'User'}</p>
                      <p className="text-sm text-stone-500">{user.email}</p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <Link
                        href="/profile"
                        onClick={() => setShowDropdown(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 transition hover:bg-stone-50"
                      >
                        <svg className="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        Profile
                      </Link>
                      <Link
                        href="/account/bookings"
                        onClick={() => setShowDropdown(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 transition hover:bg-stone-50"
                      >
                        <svg className="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                        My Trips
                      </Link>
                    </div>

                    {/* Dashboards */}
                    <div className="border-t border-stone-100 py-2">
                      {user.hasStay || user.isAdmin ? (
                        <Link
                          href="/host/dashboard"
                          onClick={() => setShowDropdown(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-[#c76f55] transition hover:bg-[#fff4ef]"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                          </svg>
                          Host dashboard
                        </Link>
                      ) : (
                        <Link
                          href="/become-a-host"
                          onClick={() => setShowDropdown(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-[#c76f55] transition hover:bg-[#fff4ef]"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          Become a Host
                        </Link>
                      )}
                      <Link
                        href="/account"
                        onClick={() => setShowDropdown(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-[#c76f55] transition hover:bg-[#fff4ef]"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
                        </svg>
                        Guest dashboard
                      </Link>
                    </div>

                    {/* Sign Out */}
                    <div className="border-t border-stone-100 py-2">
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-stone-600 transition hover:bg-stone-50"
                      >
                        <svg className="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                        </svg>
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:border-stone-400 hover:bg-stone-50 sm:h-10 sm:w-10"
                aria-label="Sign in"
                title="Sign in"
              >
                <UserIcon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 transition hover:border-stone-400 hover:bg-stone-50 md:hidden"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-stone-200 bg-white md:hidden">
          <nav className="divide-y divide-stone-100">
            <Link
              href="/stays"
              onClick={() => setMobileOpen(false)}
              className={`block px-5 py-4 font-medium ${pathname.startsWith('/stays') ? 'text-[#c76f55]' : 'text-stone-900'}`}
            >
              Stays
            </Link>
            <Link
              href="/explore"
              onClick={() => setMobileOpen(false)}
              className={`block px-5 py-4 font-medium ${pathname.startsWith('/explore') ? 'text-[#c76f55]' : 'text-stone-900'}`}
            >
              Explore
            </Link>
            <Link
              href="/how-it-works"
              onClick={() => setMobileOpen(false)}
              className={`block px-5 py-4 font-medium ${pathname === '/how-it-works' ? 'text-[#c76f55]' : 'text-stone-900'}`}
            >
              How it works
            </Link>
            {servicesBarEnabled && (
              <Link
                href="/services"
                onClick={() => setMobileOpen(false)}
                className={`block px-5 py-4 font-medium ${pathname.startsWith('/services') ? 'text-[#c76f55]' : 'text-stone-900'}`}
              >
                Services
              </Link>
            )}
            <Link
              href={user ? '/become-a-host' : '/login?redirect=/become-a-host'}
              onClick={() => setMobileOpen(false)}
              className="block px-5 py-4 font-medium text-stone-900"
            >
              List your stay
            </Link>
            <Link
              href={user ? '/account/saved' : '/login?redirect=/account/saved'}
              onClick={() => setMobileOpen(false)}
              className="block px-5 py-4 font-medium text-stone-900"
            >
              Saved stays
            </Link>

            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="block px-5 py-4 font-medium text-stone-900"
                >
                  Profile
                </Link>
                <Link
                  href="/account/bookings"
                  onClick={() => setMobileOpen(false)}
                  className="block px-5 py-4 font-medium text-stone-900"
                >
                  My trips
                </Link>
                {user.hasStay || user.isAdmin ? (
                  <Link
                    href="/host/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="block px-5 py-4 font-medium text-[#c76f55]"
                  >
                    Host dashboard
                  </Link>
                ) : (
                  <Link
                    href="/become-a-host"
                    onClick={() => setMobileOpen(false)}
                    className="block px-5 py-4 font-medium text-[#c76f55]"
                  >
                    Become a host
                  </Link>
                )}
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="block px-5 py-4 font-medium text-[#c76f55]"
                >
                  Guest dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="block w-full px-5 py-4 text-left font-medium text-stone-900"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block px-5 py-4 font-medium text-stone-900"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="block px-5 py-4 font-medium text-stone-900"
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
