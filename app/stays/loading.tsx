import { ListingGridSkeleton } from '@/components/listing-card-skeleton'

export default function StaysLoading() {
  return (
    <div className="min-h-screen">
      <div className="border-b border-stone-200 bg-[#F8F5F2]">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="h-14 w-full animate-pulse rounded-3xl bg-white shadow-sm ring-1 ring-stone-100" />
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl gap-2 overflow-hidden px-4 pt-4 pb-4 sm:px-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-9 w-28 shrink-0 animate-pulse rounded-full bg-white shadow-sm ring-1 ring-stone-100" />
        ))}
      </div>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 space-y-3">
          <div className="h-8 w-72 max-w-full animate-pulse rounded bg-stone-200/70" />
          <div className="h-4 w-40 animate-pulse rounded bg-stone-200/70" />
        </div>
        <ListingGridSkeleton count={8} />
      </div>
    </div>
  )
}
