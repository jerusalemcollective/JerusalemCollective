'use client'

import Link from 'next/link'
import { useEffect } from 'react'

type ErrorStateProps = {
  error: Error & { digest?: string }
  reset: () => void
  title?: string
  message?: string
}

export function ErrorState({
  error,
  reset,
  title = 'Something went wrong',
  message = 'We hit an unexpected error. You can try again, or head back to browsing stays.',
}: ErrorStateProps) {
  useEffect(() => {
    // Surface to the browser console / monitoring; digest links to the server log.
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center bg-[#F8F5F2] p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-stone-900">{title}</h1>
        <p className="mb-6 text-sm text-stone-600">{message}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-xl bg-[#c76f55] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#b5624a]"
          >
            Try again
          </button>
          <Link
            href="/stays"
            className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white px-6 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            Browse stays
          </Link>
        </div>
      </div>
    </div>
  )
}
