'use client'

import { ErrorState } from '@/components/error-state'

export default function Error(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      {...props}
      title="We couldn't load this stay"
      message="It may no longer be on the site, or we had a short hiccup. Please try again, or have a look at other stays."
    />
  )
}
