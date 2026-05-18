'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AvatarUpload } from '@/components/avatar-upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Profile = {
  id: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  is_host: boolean
}

type User = {
  id: string
  email: string | undefined
}

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [hasStay, setHasStay] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const router = useRouter()

  useEffect(() => {
    const loadUserAndProfile = async () => {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login?redirect=/account')
        return
      }

      setUser({ id: user.id, email: user.email })

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
        setFullName(profileData.full_name || '')
        setPhone(profileData.phone || '')
      }

      const [{ data: ownedApplication }, { data: ownedListing }] = await Promise.all([
        supabase
          .from('host_applications')
          .select('id')
          .eq('host_id', user.id)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('listings')
          .select('id')
          .eq('host_id', user.id)
          .limit(1)
          .maybeSingle(),
      ])

      setHasStay(Boolean(ownedApplication || ownedListing))

      setIsLoading(false)
    }

    loadUserAndProfile()
  }, [router])

  const handleSave = async () => {
    if (!user) return

    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone,
        })
        .eq('id', user.id)

      if (error) throw error

      setProfile(prev => prev ? { ...prev, full_name: fullName, phone } : null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F5F2]">
        <div className="text-stone-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-5 py-10 md:px-6">
        <h1 className="mb-8 text-3xl font-bold text-stone-900">Account</h1>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Sidebar */}
          <div className="space-y-2">
            <Link
              href="/account"
              className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 font-medium text-stone-900 shadow-sm"
            >
              <svg className="h-5 w-5 text-[#c76f55]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              Profile
            </Link>
            <Link
              href="/account/bookings"
              className="flex items-center gap-3 rounded-xl px-4 py-3 font-medium text-stone-600 transition hover:bg-white hover:shadow-sm"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              My Trips
            </Link>
            <Link
              href="/account/saved"
              className="flex items-center gap-3 rounded-xl px-4 py-3 font-medium text-stone-600 transition hover:bg-white hover:shadow-sm"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              Saved
            </Link>
            <Link
              href="/account/messages"
              className="flex items-center gap-3 rounded-xl px-4 py-3 font-medium text-stone-600 transition hover:bg-white hover:shadow-sm"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              Messages
            </Link>
            <Link
              href="/account/support"
              className="flex items-center gap-3 rounded-xl px-4 py-3 font-medium text-stone-600 transition hover:bg-white hover:shadow-sm"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l.75-.75.75.75m-1.5 0V15m8.25-6.75v10.5A2.25 2.25 0 0117.25 21H6.75A2.25 2.25 0 014.5 18.75V8.25m15 0L12 3.75 4.5 8.25m15 0H15a3 3 0 00-3 3v3.75" />
              </svg>
              Support
            </Link>

            <div className="pt-4">
              {hasStay ? (
                <Link
                  href="/host/dashboard"
                  className="flex items-center gap-3 rounded-xl border border-[#c76f55] px-4 py-3 font-medium text-[#c76f55] transition hover:bg-[#fff4ef]"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                  </svg>
                  Host Dashboard
                </Link>
              ) : (
                <Link
                  href="/become-a-host"
                  className="flex items-center gap-3 rounded-xl border border-[#c76f55] px-4 py-3 font-medium text-[#c76f55] transition hover:bg-[#fff4ef]"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Become a Host
                </Link>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="md:col-span-2">
            <div className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
              <div className="mb-8 flex flex-col items-center sm:flex-row sm:items-start sm:gap-8">
                <AvatarUpload
                  currentAvatarUrl={profile?.avatar_url || null}
                  userId={user?.id || ''}
                  onUploadComplete={(newUrl) => {
                    setProfile(prev => prev ? { ...prev, avatar_url: newUrl } : null)
                  }}
                  size="lg"
                />
                <div className="mt-4 text-center sm:mt-0 sm:text-left">
                  <h2 className="text-xl font-bold text-stone-900">{fullName || 'Your Name'}</h2>
                  <p className="text-stone-500">{user?.email}</p>
                  {hasStay && (
                    <span className="mt-2 inline-block rounded-full bg-[#fff4ef] px-3 py-1 text-xs font-semibold text-[#c76f55]">
                      Host
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-stone-700">
                    Full name
                  </label>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-12 rounded-xl border-stone-200 bg-[#F8F5F2] px-4"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-stone-700">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="h-12 rounded-xl border-stone-200 bg-stone-100 px-4 text-stone-500"
                  />
                  <p className="mt-1 text-xs text-stone-500">Email cannot be changed</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-stone-700">
                    Phone number
                  </label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+972 50 000 0000"
                    className="h-12 rounded-xl border-stone-200 bg-[#F8F5F2] px-4"
                  />
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-xl bg-green-50 p-3 text-sm text-green-600">
                    Changes saved successfully
                  </div>
                )}

                <div className="flex items-center justify-between pt-4">
                  <Button
                    onClick={handleSignOut}
                    variant="outline"
                    className="rounded-xl border-stone-200 text-stone-600 hover:bg-stone-50"
                  >
                    Sign out
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded-xl bg-[#c76f55] text-white hover:bg-[#b5624a]"
                  >
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
