import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'
import { describeAdminRole } from '@/lib/admin-permissions'
import {
  AUDIT_ACTION_LABELS,
  AUDIT_TARGET_TYPE_LABELS,
  describeAuditAction,
} from '@/lib/audit'
import { Pagination, normalizePaginationSearchParams, type PaginationSearchParams } from '@/components/pagination'
import { oneOrNull } from '@/lib/utils/one-or-null'

const PAGE_SIZE = 25
// Cap on ids pulled in per name search, so the filter URL stays a sane size.
const SEARCH_ID_LIMIT = 100
const TIME_ZONE = 'Asia/Jerusalem'

type Supabase = Awaited<ReturnType<typeof requireAdminPermission>>['supabase']

type AuditLogRow = {
  id: string
  action: string
  target_type: string
  target_id: string
  detail: string | null
  created_at: string
  performed_by: string | null
}

type AdminUserRow = { user_id: string; email: string | null; full_name: string | null }
type ProfileRow = { id: string; full_name: string | null }
type ListingRow = { id: string; title: string | null }
type ApplicationRow = { id: string; apartment_title: string | null; host_name: string | null }
type HostRow = { id: string; user_id: string | null; name: string | null }
type TitleEmbed = { title: string | null }
type CaseRow = { id: string; case_type: string | null; listings?: TitleEmbed | TitleEmbed[] | null }
type ReviewRow = { id: string; reviewer_name: string | null; listings?: TitleEmbed | TitleEmbed[] | null }

type Person = { name: string; email: string | null }
type Target = { name: string; sub?: string; href?: string }

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: Promise<PaginationSearchParams>
}) {
  const { supabase } = await requireAdminPermission('admins')
  const params = normalizePaginationSearchParams(searchParams ? await searchParams : {})
  const page = Math.max(1, Number(params.page) || 1)
  const search = (params.q || '').trim()
  const typeFilter = params.type && AUDIT_TARGET_TYPE_LABELS[params.type] ? params.type : ''
  const actionFilter = params.action && AUDIT_ACTION_LABELS[params.action] ? params.action : ''

  // Admins are needed both for the "who" column and for searching by admin name.
  const { data: adminData } = await supabase.rpc('list_admin_users')
  const admins = (adminData || []) as AdminUserRow[]

  let logsQuery = supabase
    .from('admin_audit_log')
    .select('id, action, target_type, target_id, detail, created_at, performed_by', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (actionFilter) {
    const [type, action] = actionFilter.split(':')
    logsQuery = logsQuery.eq('target_type', type).eq('action', action)
  } else if (typeFilter) {
    logsQuery = logsQuery.eq('target_type', typeFilter)
  }

  if (search) {
    logsQuery = logsQuery.or(await buildSearchClause(supabase, search, admins))
  }

  const { data, count } = await logsQuery.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  const logs = (data || []) as AuditLogRow[]
  const total = count || 0

  const { people, targets } = await lookUpNames(supabase, logs, admins)
  const entries = logs.map((log) => ({ log, ...describeEntry(log, people, targets) }))
  const hasFilters = Boolean(search || typeFilter || actionFilter)

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Audit log</h2>
        <p className="mt-2 text-sm text-stone-600">Every change an admin has made, newest first.</p>
      </div>

      <form method="get" className="mb-6 grid gap-3 rounded-3xl bg-white p-4 shadow-sm md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
        <label className="block text-sm font-semibold text-stone-700">
          Search
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Admin, listing, host or note"
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm font-normal text-stone-950"
          />
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          Area
          <select
            name="type"
            defaultValue={typeFilter}
            className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-normal text-stone-950"
          >
            <option value="">All areas</option>
            {Object.entries(AUDIT_TARGET_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          Action
          <select
            name="action"
            defaultValue={actionFilter}
            className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-normal text-stone-950"
          >
            <option value="">All actions</option>
            {Object.entries(AUDIT_TARGET_TYPE_LABELS).map(([type, typeLabel]) => (
              <optgroup key={type} label={typeLabel}>
                {Object.entries(AUDIT_ACTION_LABELS)
                  .filter(([key]) => key.startsWith(`${type}:`))
                  .map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            Search
          </button>
          {hasFilters && (
            <Link
              href="/admin/audit"
              className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      {entries.length === 0 ? (
        <div className="rounded-3xl bg-white px-6 py-12 text-center text-stone-500 shadow-sm">
          {hasFilters ? 'Nothing matches your search.' : 'No admin changes recorded yet.'}
        </div>
      ) : (
        <>
          {/* Phones: one card per change */}
          <ul className="space-y-3 md:hidden">
            {entries.map((entry) => (
              <li key={entry.log.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="font-semibold text-stone-950">{entry.action}</p>
                <div className="mt-1 text-sm">
                  <TargetCell target={entry.target} />
                </div>
                {entry.note && <p className="mt-2 text-sm text-stone-600">{entry.note}</p>}
                <p className="mt-3 text-xs text-stone-500">
                  {entry.who.name} · {formatWhen(entry.log.created_at)}
                </p>
              </li>
            ))}
          </ul>

          {/* Larger screens: table */}
          <div className="hidden overflow-hidden rounded-3xl bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-100 text-xs font-bold uppercase tracking-widest text-stone-500">
                <tr>
                  <th className="px-6 py-4">When</th>
                  <th className="px-6 py-4">Who</th>
                  <th className="px-6 py-4">What happened</th>
                  <th className="px-6 py-4">Done to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {entries.map((entry) => (
                  <tr key={entry.log.id} className="align-top">
                    <td className="whitespace-nowrap px-6 py-4 text-stone-700">{formatWhen(entry.log.created_at)}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-stone-950">{entry.who.name}</p>
                      {entry.who.email && entry.who.email !== entry.who.name && (
                        <p className="text-xs text-stone-500">{entry.who.email}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-stone-950">{entry.action}</p>
                      {entry.note && <p className="mt-1 text-xs text-stone-600">{entry.note}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <TargetCell target={entry.target} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pagination
        page={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        basePath="/admin/audit"
        searchParams={params}
      />
    </div>
  )
}

function TargetCell({ target }: { target: Target }) {
  return (
    <div>
      {target.href ? (
        <Link href={target.href} className="font-medium text-[#c76f55] hover:underline">
          {target.name}
        </Link>
      ) : (
        <span className="font-medium text-stone-700">{target.name}</span>
      )}
      {target.sub && <p className="text-xs text-stone-500">{target.sub}</p>}
    </div>
  )
}

function describeEntry(
  log: AuditLogRow,
  people: Map<string, Person>,
  targets: Map<string, Target>,
) {
  const who: Person = log.performed_by
    ? people.get(log.performed_by) || { name: 'Former admin', email: null }
    : { name: 'Unknown admin', email: null }

  let action = describeAuditAction(log.target_type, log.action)
  let note: string | null = log.detail
  if (log.target_type === 'user' && log.action === 'grant_admin_role') {
    action = log.detail === 'none'
      ? 'Removed admin access'
      : `Gave admin access (${describeAdminRole(log.detail)})`
    note = null
  } else if (log.action === 'edit_application_details') {
    // The detail is an internal list of field names; not useful to read.
    note = null
  } else if (log.action === 'request_changes' && log.detail) {
    note = `Sections: ${log.detail}`
  }

  const target = targets.get(targetKey(log.target_type, log.target_id)) || fallbackTarget(log)
  return { who, action, note, target }
}

function fallbackTarget(log: AuditLogRow): Target {
  if (log.target_type === 'user') return { name: log.target_id, href: '/admin/admins' }
  const kind: Record<string, string> = {
    listing: 'Listing',
    application: 'Application',
    host: 'Host',
    case: 'Dispute',
    review: 'Review',
  }
  return { name: `${kind[log.target_type] || 'Item'} no longer exists` }
}

function targetKey(type: string, id: string) {
  return `${type}:${id}`
}

// Looks up every admin and target name for this page: one batched query per table.
async function lookUpNames(supabase: Supabase, logs: AuditLogRow[], admins: AdminUserRow[]) {
  const idsOf = (type: string) => [
    ...new Set(logs.filter((log) => log.target_type === type).map((log) => log.target_id)),
  ]

  const people = new Map<string, Person>()
  for (const admin of admins) {
    people.set(admin.user_id, { name: admin.full_name || admin.email || 'Admin', email: admin.email })
  }
  // People who have since lost admin access are not in list_admin_users.
  const missingPeople = [
    ...new Set(
      logs
        .map((log) => log.performed_by)
        .filter((id): id is string => typeof id === 'string' && !people.has(id)),
    ),
  ]

  const listingIds = idsOf('listing')
  const applicationIds = idsOf('application')
  const hostIds = idsOf('host')
  const caseIds = idsOf('case')
  const reviewIds = idsOf('review')
  const none = Promise.resolve({ data: null })

  const [profiles, listings, applications, hosts, cases, reviews] = await Promise.all([
    missingPeople.length ? supabase.from('profiles').select('id, full_name').in('id', missingPeople) : none,
    listingIds.length ? supabase.from('listings').select('id, title').in('id', listingIds) : none,
    applicationIds.length
      ? supabase.from('host_applications').select('id, apartment_title, host_name').in('id', applicationIds)
      : none,
    hostIds.length ? supabase.from('hosts').select('id, user_id, name').in('id', hostIds) : none,
    caseIds.length ? supabase.from('support_cases').select('id, case_type, listings(title)').in('id', caseIds) : none,
    reviewIds.length ? supabase.from('reviews').select('id, reviewer_name, listings(title)').in('id', reviewIds) : none,
  ])

  for (const profile of (profiles.data || []) as ProfileRow[]) {
    people.set(profile.id, { name: profile.full_name || 'Former admin', email: null })
  }

  const targets = new Map<string, Target>()
  for (const listing of (listings.data || []) as ListingRow[]) {
    targets.set(targetKey('listing', listing.id), {
      name: listing.title || 'Untitled listing',
      href: `/admin/listings/${listing.id}`,
    })
  }
  for (const application of (applications.data || []) as ApplicationRow[]) {
    targets.set(targetKey('application', application.id), {
      name: application.apartment_title || 'Untitled application',
      sub: application.host_name ? `Host: ${application.host_name}` : undefined,
      href: `/admin/applications/${application.id}`,
    })
  }
  for (const host of (hosts.data || []) as HostRow[]) {
    targets.set(targetKey('host', host.id), {
      name: host.name || 'Unnamed host',
      sub: 'Host',
      href: `/admin/users/${host.user_id || host.id}`,
    })
  }
  for (const supportCase of (cases.data || []) as CaseRow[]) {
    const listingTitle = oneOrNull(supportCase.listings)?.title
    targets.set(targetKey('case', supportCase.id), {
      name: listingTitle ? `Dispute about ${listingTitle}` : 'Dispute',
      sub: supportCase.case_type ? humanize(supportCase.case_type) : undefined,
      href: '/admin/cases',
    })
  }
  for (const review of (reviews.data || []) as ReviewRow[]) {
    const listingTitle = oneOrNull(review.listings)?.title
    targets.set(targetKey('review', review.id), {
      name: `Review by ${review.reviewer_name || 'a guest'}`,
      sub: listingTitle || undefined,
      href: '/admin/reviews',
    })
  }
  // Admin-access changes are logged against the person's email.
  const adminsByEmail = new Map(
    admins.flatMap((admin) => (admin.email ? [[admin.email.toLowerCase(), admin] as const] : [])),
  )
  for (const email of idsOf('user')) {
    const admin = adminsByEmail.get(email.toLowerCase())
    targets.set(targetKey('user', email), {
      name: admin?.full_name || email,
      sub: admin?.full_name ? email : undefined,
      href: admin ? `/admin/users/${admin.user_id}` : '/admin/admins',
    })
  }

  return { people, targets }
}

// Builds a PostgREST `or` filter matching the note, the raw target (e.g. an
// email), the admin who did it, any action whose label matches, and any
// listing / application / host whose name matches.
async function buildSearchClause(supabase: Supabase, rawSearch: string, admins: AdminUserRow[]) {
  // Characters that would break the filter syntax are dropped.
  const search = rawSearch.replace(/[,()%*\\"':]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!search) return 'id.is.null'
  const lower = search.toLowerCase()
  const pattern = `%${search}%`

  const [listings, applications, hosts] = await Promise.all([
    supabase.from('listings').select('id').ilike('title', pattern).limit(SEARCH_ID_LIMIT),
    supabase
      .from('host_applications')
      .select('id')
      .or(`apartment_title.ilike.${pattern},host_name.ilike.${pattern}`)
      .limit(SEARCH_ID_LIMIT),
    supabase.from('hosts').select('id').ilike('name', pattern).limit(SEARCH_ID_LIMIT),
  ])

  const clauses = [`detail.ilike.${pattern}`, `target_id.ilike.${pattern}`]

  const adminIds = admins
    .filter((admin) => [admin.full_name, admin.email].some((value) => value?.toLowerCase().includes(lower)))
    .map((admin) => admin.user_id)
  if (adminIds.length) clauses.push(`performed_by.in.(${adminIds.join(',')})`)

  for (const [key, label] of Object.entries(AUDIT_ACTION_LABELS)) {
    if (label.toLowerCase().includes(lower)) {
      const [type, action] = key.split(':')
      clauses.push(`and(target_type.eq.${type},action.eq.${action})`)
    }
  }

  const addTargets = (type: string, rows: { id: string }[] | null) => {
    if (rows?.length) {
      clauses.push(`and(target_type.eq.${type},target_id.in.(${rows.map((row) => row.id).join(',')}))`)
    }
  }
  addTargets('listing', listings.data)
  addTargets('application', applications.data)
  addTargets('host', hosts.data)

  return clauses.join(',')
}

function humanize(value: string) {
  const words = value.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// "Today, 14:05", "Yesterday, 09:12" or "Mon, 3 Nov 2026, 14:05", in Israel time.
function formatWhen(value: string) {
  const date = new Date(value)
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(date)
  const now = new Date()
  if (dayKey(date) === dayKey(now)) return `Today, ${time}`
  if (dayKey(date) === dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return `Yesterday, ${time}`
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
  return `${day}, ${time}`
}
