'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/account'

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const resetUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        `/update-password?redirect=${encodeURIComponent(redirect)}`,
      )}`
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl,
      })

      if (error) throw error
      setSent(true)
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to send reset email.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#F8F5F2] p-6">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-stone-900">Reset your password</h1>
          <p className="mb-6 text-sm text-stone-600">
            Enter the email address used for your JLM Collective account.
          </p>

          {sent ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-green-50 p-4 text-sm leading-6 text-green-700">
                If an account exists for that email, we have sent a password reset link.
              </div>
              <Link
                href={`/login?redirect=${encodeURIComponent(redirect)}`}
                className="inline-flex text-sm font-medium text-[#c76f55] hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-700">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 rounded-xl border-stone-200 bg-[#F8F5F2] px-4"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="h-12 w-full rounded-xl bg-[#c76f55] text-white hover:bg-[#b5624a]"
                disabled={isLoading}
              >
                {isLoading ? 'Sending...' : 'Send reset link'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F8F5F2]">
          <div className="text-stone-600">Loading...</div>
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  )
}
