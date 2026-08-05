export default function StaysLoading() {
  return (
    <div className="min-h-screen bg-[#F8F5F2] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 h-14 w-full animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-stone-100" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index}>
              <div className="aspect-[4/3] animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-stone-100" />
              <div className="mt-3 space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-[#f0dfd8]" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-white shadow-sm" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-white shadow-sm" />
                <div className="h-3 w-20 animate-pulse rounded bg-white shadow-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
