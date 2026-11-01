import { ListingGridSkeleton } from '@/components/listing-card-skeleton'

export default function SavedLoading() {
  // Content only: the account layout already renders the sidebar.
  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:px-6">
      <div className="h-4 w-32 animate-pulse rounded bg-stone-200/70" />
      <div className="mb-8 mt-4 border-b border-stone-200 pb-6">
        <div className="h-8 w-44 animate-pulse rounded bg-stone-200/70" />
      </div>
      <ListingGridSkeleton count={4} />
    </div>
  )
}
