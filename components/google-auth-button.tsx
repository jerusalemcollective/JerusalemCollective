'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type GoogleAuthButtonProps = {
  redirect: string
  isHost?: boolean
  label?: string
}

export function GoogleAuthButton({
  redirect,
  isHost = false,
  label = 'Continue with Google',
}: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogleSignIn() {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const callbackUrl = new URL('/auth/callback', window.location.origin)
      callbackUrl.searchParams.set('next', redirect)
      if (isHost) callbackUrl.searchParams.set('host', '1')

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) throw error
    } catch (signInError: unknown) {
      setError(signInError instanceof Error ? signInError.message : 'Unable to continue with Google.')
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleMark />
        {isLoading ? 'Opening Google...' : label}
      </button>
      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M21.82 12.24c0-.71-.06-1.4-.18-2.06H12v3.9h5.51a4.72 4.72 0 0 1-2.04 3.1v2.53h3.26c1.91-1.76 3.09-4.35 3.09-7.47Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.76 0 5.08-.91 6.77-2.47l-3.26-2.53c-.9.6-2.06.96-3.51.96-2.69 0-4.97-1.82-5.79-4.27H2.84v2.61A10.22 10.22 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.21 13.69A6.14 6.14 0 0 1 5.88 12c0-.59.12-1.16.33-1.69V7.7H2.84A10.18 10.18 0 0 0 1.78 12c0 1.55.37 3.02 1.06 4.3l3.37-2.61Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.04c1.5 0 2.84.52 3.9 1.53l2.93-2.93C17.07 3 14.76 2 12 2a10.22 10.22 0 0 0-9.16 5.7l3.37 2.61c.82-2.45 3.1-4.27 5.79-4.27Z"
      />
    </svg>
  )
}
