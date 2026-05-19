import { requireAdminPermission } from '@/lib/admin'
import { Pagination, normalizePaginationSearchParams, type PaginationSearchParams } from '@/components/pagination'

const PAGE_SIZE = 25

type PersonRow = {
  user_id: string
  email: string | null
  full_name: string | null
  phone: string | null
  is_host: boolean
  is_admin: boolean
  admin_role: string | null
  booking_count: number
  saved_count: number
  created_at: string
  last_sign_in_at: string | null
}

export default async function AdminGuestsPage({
  searchParams,
}: {
  searchParams: Promise<PaginationSearchParams>
}) {
  const { supabase } = await requireAdminPermission('guests')
  const currentSearchParams = normalizePaginationSearchParams(await searchParams)
  const page = Math.max(1, Number(currentSearchParams.page) || 1)
  const { data, error } = await supabase.rpc('list_platform_people')

  if (error) {
    throw error
  }

  const guests = ((data || []) as PersonRow[]).filter((person) => !person.is_host)
  const paged = guests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const total = guests.length

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Guests</h2>
        <p className="mt-2 text-stone-600">
          All guest accounts with contact details and activity.
        </p>
      </div>

      <div className="overflow-hidden border-y border-stone-200">
        <div className="grid gap-4 border-b border-stone-200 py-4 text-xs font-bold uppercase tracking-widest text-stone-400 md:grid-cols-[1.1fr_1fr_0.8fr_0.65fr_0.65fr_0.8fr]">
          <span>Name</span>
          <span>Email</span>
          <span>Phone</span>
          <span>Trips</span>
          <span>Saves</span>
          <span>Status</span>
        </div>

        {paged.length === 0 ? (
          <div className="py-12 text-center text-stone-500">No guest accounts yet.</div>
        ) : (
          <div className="divide-y divide-stone-200">
            {paged.map((guest) => (
              <div
                key={guest.user_id}
                className="grid gap-4 py-5 md:grid-cols-[1.1fr_1fr_0.8fr_0.65fr_0.65fr_0.8fr] md:items-center"
              >
                <p className="font-bold text-stone-950">{guest.full_name || 'Guest'}</p>
                <p className="text-sm text-stone-700">{guest.email || 'No email'}</p>
                <p className="text-sm text-stone-700">{guest.phone || 'No phone'}</p>
                <p className="text-sm text-stone-700">{Number(guest.booking_count || 0)}</p>
                <p className="text-sm text-stone-700">{Number(guest.saved_count || 0)}</p>
                <div className="flex flex-wrap gap-2">
                  {guest.is_admin && <Badge label={guest.admin_role || 'admin'} />}
                  {!guest.is_admin && <Badge label="guest" muted />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} basePath="/admin/guests" searchParams={currentSearchParams} />
    </div>
  )
}

function Badge({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${
        muted ? 'bg-stone-200 text-stone-700' : 'bg-[#c76f55]/15 text-[#9d513b]'
      }`}
    >
      {label}
    </span>
  )
}
