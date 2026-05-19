import Link from 'next/link'

type PaginationProps = {
  page: number
  totalPages: number
  basePath: string
}

export function Pagination({ page, totalPages, basePath }: PaginationProps) {
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
          href={`${basePath}?page=${previousPage}`}
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
          href={`${basePath}?page=${nextPage}`}
          className="rounded-full border border-stone-200 px-4 py-2 font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-white"
        >
          Next
        </Link>
      )}
    </div>
  )
}
