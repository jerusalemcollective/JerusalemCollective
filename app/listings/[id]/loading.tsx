export default function ListingLoading() {
  return (
    <div className="min-h-screen bg-white px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="aspect-[4/3] animate-pulse rounded-3xl bg-[#F8F5F2] ring-1 ring-stone-100" />
        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_340px]">
          <section>
            <div className="space-y-4">
              <div className="h-8 w-3/4 animate-pulse rounded bg-[#F8F5F2]" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-[#F8F5F2]" />
              <div className="h-4 w-full animate-pulse rounded bg-[#F8F5F2]" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-[#F8F5F2]" />
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-full bg-[#F8F5F2]" />
              ))}
            </div>
          </section>
          <aside className="h-64 animate-pulse rounded-3xl bg-white shadow-lg ring-1 ring-stone-100" />
        </div>
      </div>
    </div>
  )
}
