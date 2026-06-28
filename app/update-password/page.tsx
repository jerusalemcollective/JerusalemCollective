'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

function UpdatePasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/account'

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Please use at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSaved(true)
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to update password.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#F8F5F2] p-6">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-stone-900">Choose a new password</h1>
          <p className="mb-6 text-sm text-stone-600">
            Set a new password for your JLM Collective account.
          </p>

          {saved ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-green-50 p-4 text-sm leading-6 text-green-700">
                Your password has been updated.
              </div>
              <Link
                href={`/login?redirect=${encodeURIComponent(redirect)}`}
                className="inline-flex text-sm font-medium text-[#c76f55] hover:underline"
              >
                Continue to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-700">
                  New password
                </label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 rounded-xl border-stone-200 bg-[#F8F5F2] px-4"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-700">
                  Confirm new password
                </label>
                <Input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-12 rounded-xl border-stone-200 bg-[#F8F5F2] px-4"
                />
              </div>

              {error && (
                <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="h-12 w-full rounded-xl bg-[#c76f55] text-white hover:bg-[#b85f47]"
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save new password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F8F5F2]">
          <div className="text-stone-600">Loading...</div>
        </div>
      }
    >
      <UpdatePasswordForm />
    </Suspense>
  )
}
