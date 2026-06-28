'use client'

import { createClient } from '@/lib/supabase/client'
import { ensureHostProfile } from '@/lib/host-profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GoogleAuthButton } from '@/components/google-auth-button'
import Link from 'next/link'
import Image from 'next/image'
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
  const redirect = searchParams.get('redirect') || '/become-a-host'

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
      // Check env vars are configured
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase is not configured. Please contact support.')
      }

      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
          data: {
            full_name: fullName,
            is_host: true,
          },
        },
      })

      // Check for explicit error from Supabase
      if (error) {
        throw error
      }

      // Check if user was actually created
      // Supabase returns a fake user with empty identities if email already exists (security measure)
      if (!data.user) {
        throw new Error('Failed to create account. Please try again.')
      }

      // Check for existing user (identities will be empty array if user already exists with email confirmation enabled)
      if (data.user.identities && data.user.identities.length === 0) {
        throw new Error('An account with this email already exists. Please sign in instead.')
      }

      // If we have a session (email confirmation disabled), create host profile immediately
      if (data.session && data.user) {
        try {
          await ensureHostProfile(supabase, data.user)
        } catch (profileError) {
          console.error('Could not create host profile after signup:', profileError)
        }
      }

      // Only show success if we got here without errors
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
            <h1 className="mb-2 text-2xl font-bold text-stone-900">Check your email</h1>
            <p className="mb-6 text-stone-600">
              {"We've sent a confirmation link to "}<strong>{email}</strong>. 
              Click the link to verify your account and start listing your property.
            </p>
            <Link
              href="/host/login"
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
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <Image
              src="/logos/JLM_Collective_Primary_Horizontal_Terracotta_UI.webp"
              alt="JLM Collective"
              width={512}
              height={128}
              priority
              className="h-10 w-auto"
            />
          </Link>
          <p className="mt-2 text-stone-600">Create your host account</p>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-stone-900">Become a host</h1>
          <p className="mb-6 text-sm text-stone-600">
            Create an account to list your property on JLM Collective
          </p>

          <GoogleAuthButton redirect={redirect} isHost label="Sign up with Google" />

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-stone-200" />
            <span className="text-xs font-medium uppercase tracking-widest text-stone-400">or</span>
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
              className="h-12 w-full rounded-xl bg-[#c76f55] text-white hover:bg-[#b5624a]"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-stone-600">
            Already have an account?{' '}
            <Link
              href={`/host/login?redirect=${encodeURIComponent(redirect)}`}
              className="font-medium text-[#c76f55] hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-stone-500">
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}

export default function HostRegisterPage() {
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
