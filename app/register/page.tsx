'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GoogleAuthButton } from '@/components/google-auth-button'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'

function RegisterForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/account'

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setIsLoading(false)
      return
    }

    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase is not configured. Please contact support.')
      }

      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) throw error

      if (!data.user) {
        throw new Error('Failed to create account. Please try again.')
      }

      if (data.user.identities && data.user.identities.length === 0) {
        throw new Error('An account with this email already exists. Please sign in instead.')
      }

      setSuccess(true)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred during signup'
      setError(message)
      setSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#F8F5F2] p-6">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#fff4ef] ring-1 ring-[#f0c2b3]">
              <svg
                className="h-8 w-8 text-[#c76f55]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="18" height="14" x="3" y="5" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </div>
            <h1 className="font-display mb-2 text-2xl font-bold text-stone-900">Check your email</h1>
            <p className="mb-6 text-stone-600">
              {"We've sent a confirmation link to "}<strong>{email}</strong>. 
              Click the link to verify your account.
            </p>
            <Link
              href="/login"
              className="text-sm font-medium text-[#c76f55] hover:underline"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#F8F5F2] p-6">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="font-display mb-2 text-2xl font-bold text-stone-900">Create an account</h1>
          <p className="mb-6 text-sm text-stone-600">
            Join JLM Collective to book unique stays in Jerusalem
          </p>

          <GoogleAuthButton redirect={redirect} label="Sign up with Google" />

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-stone-200" />
            <span className="text-xs font-medium uppercase tracking-widest text-stone-500">or</span>
            <span className="h-px flex-1 bg-stone-200" />
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                Full name
              </label>
              <Input
                type="text"
                placeholder="Your full name"
                required
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
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl border-stone-200 bg-[#F8F5F2] px-4"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                Password
              </label>
              <Input
                type="password"
                placeholder="At least 6 characters"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl border-stone-200 bg-[#F8F5F2] px-4"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                Confirm password
              </label>
              <Input
                type="password"
                placeholder="Repeat your password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              className="h-12 w-full rounded-xl bg-[#252525] text-white hover:bg-[#111111]"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-stone-600">
            Already have an account?{' '}
            <Link
              href={`/login?redirect=${encodeURIComponent(redirect)}`}
              className="font-medium text-[#c76f55] hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-stone-500">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="underline">Terms of Service</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#F8F5F2]">
        <div className="text-stone-600">Loading...</div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}
