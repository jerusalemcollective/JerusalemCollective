'use client'

import { ErrorState } from '@/components/error-state'

export default function Error(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      {...props}
      title="We couldn't load stays"
      message="Something went wrong while fetching listings. Try again in a moment."
    />
  )
}
