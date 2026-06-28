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

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/become-a-host'
  const sessionExpiredAt = Number(searchParams.get('at'))
  const sessionExpired =
    searchParams.get('reason') === 'session-expired' &&
    Number.isFinite(sessionExpiredAt) &&
    Date.now() - sessionExpiredAt < 5 * 60 * 1000

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        try {
          await ensureHostProfile(supabase, user)
        } catch (profileError) {
          console.error('Could not create host profile after login:', profileError)
        }
      }
      router.push(redirect)
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
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
          <p className="mt-2 text-stone-600">Host Portal</p>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-stone-900">Welcome back</h1>
          <p className="mb-6 text-sm text-stone-600">
            Sign in to manage your listings
          </p>

          {sessionExpired && (
            <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              You were signed out after 30 minutes of inactivity.
            </div>
          )}

          <GoogleAuthButton redirect={redirect} isHost />

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-stone-200" />
            <span className="text-xs font-medium uppercase tracking-widest text-stone-400">or</span>
            <span className="h-px flex-1 bg-stone-200" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
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
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-stone-700">
                  Password
                </label>
                <Link
                  href={`/forgot-password?redirect=${encodeURIComponent(redirect)}`}
                  className="text-sm font-medium text-[#c76f55] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-stone-600">
            {"Don't have an account? "}
            <Link
              href={`/host/register?redirect=${encodeURIComponent(redirect)}`}
              className="font-medium text-[#c76f55] hover:underline"
            >
              Create one
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-stone-500">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}

export default function HostLoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#F8F5F2]">
        <div className="text-stone-600">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
