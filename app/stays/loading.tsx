export default function StaysLoading() {
  return (
    <main className="min-h-screen bg-[#F8F5F2] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 h-14 w-full animate-pulse rounded-2xl bg-stone-200" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl bg-white p-0 shadow-sm">
              <div className="aspect-[4/3] animate-pulse bg-stone-200" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-stone-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-stone-200" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-stone-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
