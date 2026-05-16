'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

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
    src="/icons/yemin-moshe-save-128.png"
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

type UserState = {
  id: string
  email: string | undefined
  avatarUrl: string | null
  fullName: string | null
  isHost: boolean
} | null

export function Header() {
  const [user, setUser] = useState<UserState>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        
        if (authUser) {
          // Fetch profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, is_host')
            .eq('id', authUser.id)
            .single()

          setUser({
            id: authUser.id,
            email: authUser.email,
            avatarUrl: profile?.avatar_url || null,
            fullName: profile?.full_name || null,
            isHost: profile?.is_host || false,
          })
        }
      } catch (error) {
        // User not logged in or error fetching profile
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()

    // Listen for auth changes
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
      } else if (event === 'SIGNED_IN') {
        loadUser()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setShowDropdown(false)
    window.location.href = '/'
  }

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

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/become-a-host"
            className="hidden rounded-full bg-[#252525] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#111111] sm:inline-flex md:px-5"
          >
            List your stay
          </Link>

          <Link
            href={user ? "/account/saved" : "/login?redirect=/account/saved"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:border-stone-400 hover:bg-stone-50 sm:h-10 sm:w-10"
            aria-label="Saved stays"
            title="Saved stays"
          >
            <SavedStayIcon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
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
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-white transition hover:border-stone-400 hover:bg-stone-50 sm:h-10 sm:w-10"
                  aria-label="Account menu"
                  title="Account"
                >
                  {user.avatarUrl ? (
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
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
                    {/* User Info */}
                    <div className="border-b border-stone-100 px-4 py-3">
                      <p className="font-semibold text-stone-900">{user.fullName || 'User'}</p>
                      <p className="text-sm text-stone-500">{user.email}</p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <Link
                        href="/account"
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
                      <Link
                        href="/account/saved"
                        onClick={() => setShowDropdown(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 transition hover:bg-stone-50"
                      >
                        <svg className="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                        Saved
                      </Link>
                      <Link
                        href="/account/messages"
                        onClick={() => setShowDropdown(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 transition hover:bg-stone-50"
                      >
                        <svg className="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                        </svg>
                        Messages
                      </Link>
                    </div>

                    {/* Host Section */}
                    <div className="border-t border-stone-100 py-2">
                      {user.isHost ? (
                        <Link
                          href="/host/dashboard"
                          onClick={() => setShowDropdown(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-[#c76f55] transition hover:bg-[#fff4ef]"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                          </svg>
                          Host Dashboard
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
        </div>
      </div>
    </header>
  )
}
