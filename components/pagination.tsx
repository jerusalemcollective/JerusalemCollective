import Link from 'next/link'

export type PaginationSearchParams = Record<string, string | undefined>

type PaginationProps = {
  page: number
  totalPages: number
  basePath: string
  searchParams: Record<string, string>
}

export function normalizePaginationSearchParams(searchParams: PaginationSearchParams) {
  return Object.fromEntries(
    Object.entries(searchParams).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

function buildUrl(basePath: string, searchParams: Record<string, string>, page: number) {
  const params = new URLSearchParams({ ...searchParams, page: String(page) })
  return `${basePath}?${params.toString()}`
}

export function Pagination({ page, totalPages, basePath, searchParams }: PaginationProps) {
  const lastPage = Math.max(1, totalPages)
  const previousPage = Math.max(1, page - 1)
  const nextPage = Math.min(lastPage, page + 1)
  const isFirstPage = page <= 1
  const isLastPage = page >= lastPage

  return (
    <div className="mt-6 flex items-center justify-between text-sm text-stone-600">
      {isFirstPage ? (
        <span className="rounded-full border border-stone-200 px-4 py-2 text-stone-300">Previous</span>
      ) : (
        <Link
          href={buildUrl(basePath, searchParams, previousPage)}
          className="rounded-full border border-stone-200 px-4 py-2 font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-white"
        >
          Previous
        </Link>
      )}

      <span className="font-medium text-stone-500">
        Page {page} of {lastPage}
      </span>

      {isLastPage ? (
        <span className="rounded-full border border-stone-200 px-4 py-2 text-stone-300">Next</span>
      ) : (
        <Link
          href={buildUrl(basePath, searchParams, nextPage)}
          className="rounded-full border border-stone-200 px-4 py-2 font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-white"
        >
          Next
        </Link>
      )}
    </div>
  )
}
