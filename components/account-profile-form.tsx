'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AvatarUpload } from '@/components/avatar-upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type AccountProfileFormProps = {
  user: {
    id: string
    email: string
  }
  profile: {
    full_name: string | null
    phone: string | null
    avatar_url: string | null
  } | null
  hasStay: boolean
}

export function AccountProfileForm({ user, profile, hasStay }: AccountProfileFormProps) {
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null)
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone,
        })
        .eq('id', user.id)

      if (error) throw error

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
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

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm md:p-8">
      <div className="mb-8 flex flex-col items-center sm:flex-row sm:items-start sm:gap-8">
        <AvatarUpload
          currentAvatarUrl={avatarUrl}
          userId={user.id}
          onUploadComplete={(newUrl) => setAvatarUrl(newUrl)}
          size="lg"
        />
        <div className="mt-4 text-center sm:mt-0 sm:text-left">
          <h2 className="text-xl font-bold text-stone-900">{fullName || 'Your name'}</h2>
          <p className="text-stone-500">{user.email}</p>
          {hasStay && (
            <span className="mt-2 inline-block rounded-full bg-[#fff4ef] px-3 py-1 text-xs font-semibold text-[#c76f55]">
              Host
            </span>
          )}
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-stone-700">Full name</label>
          <Input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="h-12 rounded-lg border-stone-200 bg-[#F8F5F2] px-4"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-stone-700">Email</label>
          <Input
            type="email"
            value={user.email}
            disabled
            className="h-12 rounded-lg border-stone-200 bg-stone-100 px-4 text-stone-500"
          />
          <p className="mt-1 text-xs text-stone-500">Email cannot be changed</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-stone-700">Phone number</label>
          <Input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+972 50 000 0000"
            className="h-12 rounded-lg border-stone-200 bg-[#F8F5F2] px-4"
          />
        </div>

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        {success && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
            Changes saved successfully
          </div>
        )}

        <div className="flex items-center justify-between pt-4">
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="rounded-lg border-stone-200 text-stone-600 hover:bg-stone-50"
          >
            Sign out
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-[#c76f55] text-white hover:bg-[#b5624a]"
          >
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
