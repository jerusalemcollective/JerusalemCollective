import { ListingGridSkeleton } from '@/components/listing-card-skeleton'

export default function NeighbourhoodLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        <div className="h-4 w-32 animate-pulse rounded bg-stone-200/70" />
        <div className="mt-4 h-10 w-80 max-w-full animate-pulse rounded bg-stone-200/70" />
        <div className="mt-5 max-w-2xl space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-stone-200/70" />
          <div className="h-4 w-full animate-pulse rounded bg-stone-200/70" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-stone-200/70" />
        </div>
        <ListingGridSkeleton count={8} className="mt-10" />
      </div>
    </div>
  )
}
