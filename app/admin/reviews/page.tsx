import { requireAdminPermission } from '@/lib/admin'
import { updateReviewApproval } from '@/app/admin/actions'

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

export default async function AdminReviewsPage() {
  const { supabase } = await requireAdminPermission('reviews')
  const { data } = await supabase
    .from('reviews')
    .select('id, reviewer_name, rating, title, content, is_approved, created_at, listings(title)')
    .order('created_at', { ascending: false })

  const reviews = (data || []) as ReviewRow[]

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Reviews</h2>
        <p className="mt-2 text-stone-600">Approve or hide guest reviews before they appear publicly.</p>
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
    </div>
  )
}

function BooleanBadge({
  value,
  yes,
  no,
}: {
  value: boolean
  yes: string
  no: string
}) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${
        value ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-700'
      }`}
    >
      {value ? yes : no}
    </span>
  )
}
