export default function AccountLoading() {
  // The account layout already provides the sidebar and the page shell, so this
  // skeleton renders only the content card — otherwise a second skeleton sidebar
  // appears next to the real one during load.
  return (
    <div>
      <div className="mb-5 border-b border-stone-200 pb-4">
        <div className="h-8 w-32 animate-pulse rounded bg-stone-200" />
      </div>

      <div className="rounded-lg bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex flex-col items-center sm:flex-row sm:items-center sm:gap-6">
          <div className="h-24 w-24 animate-pulse rounded-full bg-stone-200" />
          <div className="mt-3 w-full max-w-sm space-y-3 sm:mt-0">
            <div className="h-6 w-44 animate-pulse rounded bg-stone-200" />
            <div className="h-4 w-64 animate-pulse rounded bg-stone-200" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="h-14 animate-pulse rounded-lg bg-stone-200" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-14 animate-pulse rounded-lg bg-stone-200" />
            <div className="h-14 animate-pulse rounded-lg bg-stone-200" />
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="h-10 w-24 animate-pulse rounded-lg bg-stone-200" />
            <div className="h-10 w-32 animate-pulse rounded-lg bg-stone-200" />
          </div>
        </div>
      </div>
    </div>
  )
}
