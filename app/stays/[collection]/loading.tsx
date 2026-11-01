import { ListingGridSkeleton } from '@/components/listing-card-skeleton'

export default function StayCollectionLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        <div className="h-4 w-40 animate-pulse rounded bg-stone-200/70" />
        <div className="mt-4 h-3 w-24 animate-pulse rounded bg-[#f0dfd8]" />
        <div className="mt-3 h-10 w-96 max-w-full animate-pulse rounded bg-stone-200/70" />
        <div className="mt-5 max-w-2xl space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-stone-200/70" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-stone-200/70" />
        </div>
        <ListingGridSkeleton count={8} className="mt-10" />
      </div>
    </div>
  )
}
