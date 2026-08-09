import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'
import { updateReviewApproval } from '@/app/admin/review-actions'
import { BooleanBadge } from '@/components/boolean-badge'
import { Pagination, normalizePaginationSearchParams, type PaginationSearchParams } from '@/components/pagination'
import { oneOrNull } from '@/lib/utils/one-or-null'

const PAGE_SIZE = 25

type ReviewRow = {
  id: string
  reviewer_name: string
  rating: number
  title: string | null
  content: string | null
  is_approved: boolean
  created_at: string
  listings?: {
    title: string
  } | null
}

type ReviewQueryRow = Omit<ReviewRow, 'listings'> & {
  listings?: ReviewRow['listings'] | NonNullable<ReviewRow['listings']>[] | null
}

function buildAdminUrl(
  basePath: string,
  currentParams: Record<string, string | undefined>,
  updates: Record<string, string>,
): string {
  const params = new URLSearchParams()
  Object.entries({
    ...currentParams,
    ...updates,
    page: '1',
  }).forEach(([key, value]) => {
    if (value && value !== 'all') {
      params.set(key, value)
    }
  })
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams?: Promise<PaginationSearchParams>
}) {
  const { supabase } = await requireAdminPermission('reviews')
  const currentSearchParams = normalizePaginationSearchParams(searchParams ? await searchParams : {})
  const approvedFilter = currentSearchParams.approved || 'all'
  const page = Math.max(1, Number(currentSearchParams.page) || 1)
  let reviewsQuery = supabase
    .from('reviews')
    .select('id, reviewer_name, rating, title, content, is_approved, created_at, listings(title)')
    .order('created_at', { ascending: false })
  let countQuery = supabase.from('reviews').select('*', { count: 'exact', head: true })

  if (approvedFilter === 'approved') {
    reviewsQuery = reviewsQuery.eq('is_approved', true)
    countQuery = countQuery.eq('is_approved', true)
  } else if (approvedFilter === 'hidden') {
    reviewsQuery = reviewsQuery.eq('is_approved', false)
    countQuery = countQuery.eq('is_approved', false)
  }

  const [{ data }, { count }] = await Promise.all([
    reviewsQuery.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    countQuery,
  ])

  const reviews: ReviewRow[] = (data || []).map((review: ReviewQueryRow) => ({
    ...review,
    listings: oneOrNull(review.listings),
  }))
  const total = count || 0

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Reviews</h2>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { label: 'All', value: 'all' },
          { label: 'Approved', value: 'approved' },
          { label: 'Hidden', value: 'hidden' },
        ].map((option) => (
          <Link
            key={option.value}
            href={buildAdminUrl('/admin/reviews', currentSearchParams, { approved: option.value })}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              approvedFilter === option.value
                ? 'bg-stone-950 text-white'
                : 'border border-stone-200 bg-white text-stone-700 hover:border-stone-300'
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="rounded-3xl bg-white px-6 py-12 text-center text-stone-500 shadow-sm">
            No reviews yet.
          </div>
        ) : (
          reviews.map((review) => (
            <article key={review.id} className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-500">
                    {review.listings?.title || 'Listing'} · {review.reviewer_name}
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-stone-950">
                    {review.title || `${review.rating}/5 review`}
                  </h3>
                  {review.content && (
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">{review.content}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <BooleanBadge value={review.is_approved} yes="Approved" no="Hidden" />
                  <form action={updateReviewApproval}>
                    <input type="hidden" name="reviewId" value={review.id} />
                    <input type="hidden" name="value" value={String(!review.is_approved)} />
                    <button className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 transition hover:border-stone-300">
                      {review.is_approved ? 'Hide' : 'Approve'}
                    </button>
                  </form>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} basePath="/admin/reviews" searchParams={currentSearchParams} />
    </div>
  )
}

