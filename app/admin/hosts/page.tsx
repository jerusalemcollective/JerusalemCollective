import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'
import {
  updateHostCommissionOverride,
  updateHostListingBlock,
  updateHostVerification,
} from '@/app/admin/host-actions'
import { ConfirmSubmitButton } from '@/components/confirm-submit-button'
import { BooleanBadge } from '@/components/boolean-badge'
import { Pagination, normalizePaginationSearchParams, type PaginationSearchParams } from '@/components/pagination'

const PAGE_SIZE = 25

type PersonRow = {
  user_id: string
  email: string | null
  full_name: string | null
  host_id: string | null
  host_name: string | null
  host_type: string | null
  host_is_verified: boolean | null
  listing_blocked?: boolean | null
  listing_blocked_reason?: string | null
  listing_count: number
  application_count: number
  created_at: string
  last_sign_in_at: string | null
}

type HostBlockRow = {
  id: string
  listing_blocked: boolean | null
  listing_blocked_reason: string | null
}

type HostPaymentProfileRow = {
  host_id: string
  commission_percent_override: number | null
}

type PlatformSettingRow = {
  key: string
  value: string
}

export default async function AdminHostsPage({
  searchParams,
}: {
  searchParams?: Promise<PaginationSearchParams>
}) {
  const { supabase } = await requireAdminPermission('hosts')
  const currentSearchParams = normalizePaginationSearchParams(searchParams ? await searchParams : {})
  const page = Math.max(1, Number(currentSearchParams.page) || 1)
  const [{ data, error }, { data: platformSettings }] = await Promise.all([
    supabase.rpc('list_platform_people'),
    supabase
      .from('platform_settings')
      .select('key, value')
      .eq('key', 'commission_percent'),
  ])

  if (error) {
    throw error
  }

  const hostRows: PersonRow[] = (data || [])
    .map((person: PersonRow) => ({
      user_id: person.user_id,
      email: person.email,
      full_name: person.full_name,
      host_id: person.host_id,
      host_name: person.host_name,
      host_type: person.host_type,
      host_is_verified: person.host_is_verified,
      listing_count: Number(person.listing_count || 0),
      application_count: Number(person.application_count || 0),
      created_at: person.created_at,
      last_sign_in_at: person.last_sign_in_at,
    }))
    .filter((person: PersonRow) => person.host_id)
  const hostIds = hostRows
    .map((host) => host.host_id)
    .filter((hostId): hostId is string => Boolean(hostId))
  const { data: blockData } = hostIds.length
    ? await supabase
        .from('hosts')
        .select('id, listing_blocked, listing_blocked_reason')
        .in('id', hostIds)
    : { data: [] }
  const { data: paymentProfileData } = hostIds.length
    ? await supabase
        .from('host_payment_profiles')
        .select('host_id, commission_percent_override')
        .in('host_id', hostIds)
    : { data: [] }
  const blockStatusByHost = new Map(
    ((blockData || []) as HostBlockRow[]).map((host) => [host.id, host]),
  )
  const commissionByHost = new Map(
    ((paymentProfileData || []) as HostPaymentProfileRow[]).map((profile) => [
      profile.host_id,
      profile.commission_percent_override,
    ]),
  )
  const defaultCommission = parseCommissionValue(
    ((platformSettings || []) as PlatformSettingRow[]).find((setting) => setting.key === 'commission_percent')?.value,
  )
  const hosts = hostRows.map((host) => {
    const blockStatus = host.host_id ? blockStatusByHost.get(host.host_id) : null
    const commissionOverride = host.host_id ? commissionByHost.get(host.host_id) ?? null : null

    return {
      ...host,
      listing_blocked: blockStatus?.listing_blocked ?? false,
      listing_blocked_reason: blockStatus?.listing_blocked_reason ?? null,
      commission_percent_override: commissionOverride,
      effective_commission_percent: commissionOverride ?? defaultCommission,
    }
  })
  const paged = hosts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const total = hosts.length

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Hosts</h2>
        <p className="mt-2 text-stone-600">
          All host accounts, their contact details, verification, and inventory.
        </p>
      </div>

      <div className="overflow-hidden border-y border-stone-200">
        <div className="grid gap-4 border-b border-stone-200 py-4 text-xs font-bold uppercase tracking-widest text-stone-400 md:grid-cols-[1.15fr_1fr_0.7fr_0.8fr_0.8fr_1fr_1.1fr]">
          <span>Host</span>
          <span>Email</span>
          <span>Type</span>
          <span>Inventory</span>
          <span>Status</span>
          <span>Commission</span>
          <span>Action</span>
        </div>

        {paged.length === 0 ? (
          <div className="py-12 text-center text-stone-500">No hosts yet.</div>
        ) : (
          <div className="divide-y divide-stone-200">
            {paged.map((host) => (
              <div
                key={host.host_id}
                className="grid gap-4 py-5 md:grid-cols-[1.15fr_1fr_0.7fr_0.8fr_0.8fr_1fr_1.1fr] md:items-center"
              >
                <Link href={`/hosts/${host.host_id}`} className="font-bold text-stone-950 hover:underline">
                  {host.host_name || host.full_name || 'Host'}
                </Link>
                <p className="text-sm text-stone-700">{host.email || 'No email'}</p>
                <p className="text-sm text-stone-700">{host.host_type || 'owner'}</p>
                <p className="text-sm text-stone-700">
                  {Number(host.listing_count || 0)} live / {Number(host.application_count || 0)} submitted
                </p>
                <div className="space-y-2">
                  <BooleanBadge value={Boolean(host.host_is_verified)} yes="Verified" no="Unverified" falseTone="strong" />
                  {host.listing_blocked && (
                    <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
                      Listing blocked
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    {formatCommission(host.effective_commission_percent)}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {host.commission_percent_override === null
                      ? `Default ${formatCommission(defaultCommission)}`
                      : 'Custom host rate'}
                  </p>
                  <form action={updateHostCommissionOverride} className="mt-2 flex gap-2">
                    <input type="hidden" name="hostId" value={host.host_id || ''} />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="commissionOverride"
                      defaultValue={host.commission_percent_override ?? ''}
                      placeholder="Default"
                      className="min-w-0 flex-1 rounded-full border border-stone-200 px-3 py-1.5 text-xs text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]"
                      aria-label="Host commission override"
                    />
                    <button
                      type="submit"
                      className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 transition hover:border-stone-300"
                    >
                      Save
                    </button>
                  </form>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={updateHostVerification}>
                    <input type="hidden" name="hostId" value={host.host_id || ''} />
                    <input type="hidden" name="value" value={String(!host.host_is_verified)} />
                    <ConfirmSubmitButton
                      message="Are you sure?"
                      className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 transition hover:border-stone-300"
                    >
                      {host.host_is_verified ? 'Remove verification' : 'Verify'}
                    </ConfirmSubmitButton>
                  </form>
                  <form action={updateHostListingBlock}>
                    <input type="hidden" name="hostId" value={host.host_id || ''} />
                    <input type="hidden" name="value" value={String(!host.listing_blocked)} />
                    <input type="hidden" name="reason" value="Blocked by platform admin" />
                    <ConfirmSubmitButton
                      message={host.listing_blocked ? 'Allow this host to list again?' : 'Block this host from listing and hide their live listings?'}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                        host.listing_blocked
                          ? 'border border-stone-200 text-stone-700 hover:border-stone-300'
                          : 'bg-rose-600 text-white hover:bg-rose-700'
                      }`}
                    >
                      {host.listing_blocked ? 'Unblock listing' : 'Block listing'}
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} basePath="/admin/hosts" searchParams={currentSearchParams} />
    </div>
  )
}

function parseCommissionValue(value?: string) {
  const numberValue = Number(value || 0)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0
}

function formatCommission(value: number) {
  return `${value.toLocaleString('en-GB', {
    maximumFractionDigits: 2,
  })}%`
}

