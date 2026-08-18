import Link from 'next/link'
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
  host_id: string | null
  booking_count: number
  saved_count: number
  created_at: string
  last_sign_in_at: string | null
}

type Person = {
  user_id: string
  email: string | null
  full_name: string | null
  phone: string | null
  isHost: boolean
  isGuest: boolean
  isAdmin: boolean
  admin_role: string | null
  booking_count: number
  saved_count: number
}

const ROLE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'host', label: 'Hosts' },
  { key: 'guest', label: 'Guests' },
  { key: 'admin', label: 'Admins' },
] as const

type UsersSearchParams = PaginationSearchParams & { role?: string }

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<UsersSearchParams>
}) {
  const { supabase } = await requireAdminPermission('users')
  const resolvedParams = searchParams ? await searchParams : {}
  const currentSearchParams = normalizePaginationSearchParams(resolvedParams)
  const page = Math.max(1, Number(currentSearchParams.page) || 1)
  const activeRole = ROLE_FILTERS.some((filter) => filter.key === resolvedParams.role)
    ? (resolvedParams.role as string)
    : 'all'

  const { data, error } = await supabase.rpc('list_platform_people')
  if (error) throw error

  const people: Person[] = (data || []).map((person: PersonRow) => {
    const isHost = Boolean(person.is_host) || Boolean(person.host_id)
    const hasGuestActivity = Number(person.booking_count || 0) > 0 || Number(person.saved_count || 0) > 0
    // Every non-host account is a guest by default; a host is also a guest once
    // they have guest activity (a booking or a save).
    const isGuest = hasGuestActivity || !isHost
    return {
      user_id: person.user_id,
      email: person.email,
      full_name: person.full_name,
      phone: person.phone,
      isHost,
      isGuest,
      isAdmin: Boolean(person.is_admin),
      admin_role: person.admin_role,
      booking_count: Number(person.booking_count || 0),
      saved_count: Number(person.saved_count || 0),
    }
  })

  const filtered = people.filter((person) => {
    if (activeRole === 'host') return person.isHost
    if (activeRole === 'guest') return person.isGuest
    if (activeRole === 'admin') return person.isAdmin
    return true
  })

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const total = filtered.length

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Users</h2>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {ROLE_FILTERS.map((filter) => {
          const isActive = activeRole === filter.key
          const href = filter.key === 'all' ? '/admin/users' : `/admin/users?role=${filter.key}`
          return (
            <Link
              key={filter.key}
              href={href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'bg-stone-950 text-white'
                  : 'border border-stone-200 bg-white text-stone-700 hover:border-[#c76f55] hover:text-[#c76f55]'
              }`}
            >
              {filter.label}
            </Link>
          )
        })}
      </div>

      <div className="overflow-hidden border-y border-stone-200">
        <div className="grid gap-4 border-b border-stone-200 py-4 text-xs font-bold uppercase tracking-widest text-stone-500 md:grid-cols-[1.1fr_1fr_0.8fr_0.9fr_0.5fr_0.5fr]">
          <span>Name</span>
          <span>Email</span>
          <span>Phone</span>
          <span>Roles</span>
          <span>Trips</span>
          <span>Saves</span>
        </div>

        {paged.length === 0 ? (
          <div className="py-12 text-center text-stone-500">No users match this filter.</div>
        ) : (
          <div className="divide-y divide-stone-200">
            {paged.map((person) => (
              <Link
                key={person.user_id}
                href={`/admin/users/${person.user_id}`}
                className="grid gap-4 py-5 transition hover:bg-stone-50 md:grid-cols-[1.1fr_1fr_0.8fr_0.9fr_0.5fr_0.5fr] md:items-center"
              >
                <p className="font-bold text-stone-950">{person.full_name || 'Unnamed user'}</p>
                <p className="truncate text-sm text-stone-700">{person.email || 'No email'}</p>
                <p className="text-sm text-stone-700">{person.phone || 'No phone'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {person.isHost && <RolePill label="Host" />}
                  {person.isGuest && <RolePill label="Guest" muted />}
                  {person.isAdmin && <RolePill label={person.admin_role || 'admin'} accent />}
                </div>
                <p className="text-sm text-stone-700">{person.booking_count}</p>
                <p className="text-sm text-stone-700">{person.saved_count}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        basePath="/admin/users"
        searchParams={currentSearchParams}
      />
    </div>
  )
}

function RolePill({ label, muted = false, accent = false }: { label: string; muted?: boolean; accent?: boolean }) {
  const tone = accent
    ? 'bg-[#c76f55]/15 text-[#9d513b]'
    : muted
      ? 'bg-stone-200 text-stone-700'
      : 'bg-stone-950 text-white'
  return (
    <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${tone}`}>{label}</span>
  )
}
