import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'

type ListingReadinessRow = {
  id: string
  title: string
  area: string | null
  is_published: boolean | null
  bedrooms: number | null
  max_guests: number | null
  sleeping_setup: string | null
  price_ils: number | null
  price_usd: number | null
}

type ListingPhotoRow = {
  listing_id: string | null
}

type HostRow = {
  id: string
  listing_blocked?: boolean | null
}

type HostPaymentProfileRow = {
  host_id: string
  payout_setup_status: string | null
  stripe_payouts_enabled: boolean | null
}

type PlatformSettingRow = {
  key: string
  value: string
}

type ReadinessTone = 'green' | 'amber' | 'rose' | 'stone'

export default async function AdminReadinessPage() {
  const { supabase, adminRole } = await requireAdmin()

  if (adminRole !== 'owner') {
    redirect('/admin')
  }

  const [
    { data: listingsData },
    { data: photosData },
    { data: hostsData },
    { count: pendingApplicationsCount },
    { data: paymentProfilesData },
    { data: settingsData },
  ] = await Promise.all([
    supabase
      .from('listings')
      .select('id, title, area, is_published, bedrooms, max_guests, sleeping_setup, price_ils, price_usd'),
    supabase
      .from('listing_photos')
      .select('listing_id'),
    supabase
      .from('hosts')
      .select('id, listing_blocked'),
    supabase
      .from('host_applications')
      .select('*', { count: 'exact', head: true })
      .in('status', ['new', 'pending', 'submitted', 'in_review', 'changes_requested']),
    supabase
      .from('host_payment_profiles')
      .select('host_id, payout_setup_status, stripe_payouts_enabled'),
    supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['services_bar_enabled', 'commission_percent']),
  ])

  const listings: ListingReadinessRow[] = (listingsData || []).map((listing: ListingReadinessRow) => ({
    id: listing.id,
    title: listing.title,
    area: listing.area,
    is_published: listing.is_published,
    bedrooms: listing.bedrooms,
    max_guests: listing.max_guests,
    sleeping_setup: listing.sleeping_setup,
    price_ils: listing.price_ils,
    price_usd: listing.price_usd,
  }))
  const liveListings = listings.filter((listing) => listing.is_published)
  const photoCounts = countPhotosByListing(
    (photosData || []).map((photo: ListingPhotoRow) => ({
      listing_id: photo.listing_id,
    })),
  )
  const liveListingsMissingPhotos = liveListings.filter(
    (listing) => (photoCounts.get(listing.id) || 0) < 5,
  )
  const liveListingsMissingPrice = liveListings.filter(
    (listing) => !listing.price_ils && !listing.price_usd,
  )
  const liveListingsMissingSleepingSetup = liveListings.filter(
    (listing) => !listing.sleeping_setup?.trim(),
  )
  const liveListingsMissingCapacity = liveListings.filter(
    (listing) => listing.bedrooms === null || listing.max_guests === null || listing.max_guests < 1,
  )
  const weakListings = liveListings
    .map((listing) => ({
      ...listing,
      photoCount: photoCounts.get(listing.id) || 0,
      issues: [
        (photoCounts.get(listing.id) || 0) < 5 ? 'Needs 5+ photos' : null,
        !listing.price_ils && !listing.price_usd ? 'Missing price' : null,
        !listing.sleeping_setup?.trim() ? 'Missing sleeping setup' : null,
        listing.bedrooms === null || listing.max_guests === null || listing.max_guests < 1 ? 'Missing capacity' : null,
      ].filter((issue): issue is string => Boolean(issue)),
    }))
    .filter((listing) => listing.issues.length > 0)

  const hosts: HostRow[] = (hostsData || []).map((host: HostRow) => ({
    id: host.id,
    listing_blocked: host.listing_blocked,
  }))
  const blockedHosts = hosts.filter((host) => host.listing_blocked)

  const paymentProfiles: HostPaymentProfileRow[] = (paymentProfilesData || []).map((profile: HostPaymentProfileRow) => ({
    host_id: profile.host_id,
    payout_setup_status: profile.payout_setup_status,
    stripe_payouts_enabled: profile.stripe_payouts_enabled,
  }))
  const paymentReadyCount = paymentProfiles.filter(
    (profile) => profile.payout_setup_status === 'ready' || profile.stripe_payouts_enabled,
  ).length
  const paymentNotReadyCount = Math.max(hosts.length - paymentReadyCount, 0)

  const settings: PlatformSettingRow[] = (settingsData || []).map((setting: PlatformSettingRow) => ({
    key: setting.key,
    value: setting.value,
  }))
  const serviceVisibility = settings.find((setting) => setting.key === 'services_bar_enabled')?.value !== 'false'
  const commissionPercent = settings.find((setting) => setting.key === 'commission_percent')?.value ?? '0'

  const launchBlockers = [
    liveListingsMissingPhotos.length,
    liveListingsMissingPrice.length,
    liveListingsMissingSleepingSetup.length,
    liveListingsMissingCapacity.length,
    Number(pendingApplicationsCount || 0),
  ].filter((count) => count > 0).length

  return (
    <div>
      <header className="border-b border-stone-200 pb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
          Owner command center
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">
          Platform readiness
        </h2>
        <p className="mt-2 max-w-2xl text-stone-600">
          A launch cockpit for the settings, listings, hosts, and review queues that need attention.
        </p>
      </header>

      <section className="grid gap-4 py-6 sm:grid-cols-2 xl:grid-cols-4">
        <ReadinessCard
          title="Live listings"
          value={liveListings.length}
          detail="Published stays visible to guests."
          href="/admin/listings?published=live"
          action="Review listings"
          tone={liveListings.length > 0 ? 'green' : 'amber'}
        />
        <ReadinessCard
          title="Missing photos"
          value={liveListingsMissingPhotos.length}
          detail="Live listings with fewer than 5 photos."
          href="/admin/listings?published=live"
          action="Fix listings"
          tone={liveListingsMissingPhotos.length > 0 ? 'rose' : 'green'}
        />
        <ReadinessCard
          title="Missing price"
          value={liveListingsMissingPrice.length}
          detail="Live listings without ILS or USD pricing."
          href="/admin/listings?published=live"
          action="Add pricing"
          tone={liveListingsMissingPrice.length > 0 ? 'rose' : 'green'}
        />
        <ReadinessCard
          title="Missing sleep setup"
          value={liveListingsMissingSleepingSetup.length}
          detail="Live listings without clear sleeping arrangements."
          href="/admin/listings?published=live"
          action="Fix setup"
          tone={liveListingsMissingSleepingSetup.length > 0 ? 'rose' : 'green'}
        />
        <ReadinessCard
          title="Pending applications"
          value={pendingApplicationsCount || 0}
          detail="Applications still waiting for action."
          href="/admin/applications"
          action="Review queue"
          tone={(pendingApplicationsCount || 0) > 0 ? 'amber' : 'green'}
        />
        <ReadinessCard
          title="Blocked hosts"
          value={blockedHosts.length}
          detail="Hosts currently blocked from new listings."
          href="/admin/hosts"
          action="Manage hosts"
          tone={blockedHosts.length > 0 ? 'amber' : 'green'}
        />
        <ReadinessCard
          title="Payment setup"
          value={`${paymentReadyCount}/${hosts.length}`}
          detail={`${paymentNotReadyCount} host${paymentNotReadyCount === 1 ? '' : 's'} not payout-ready.`}
          href="/host/dashboard/payments"
          action="Check setup"
          tone={paymentNotReadyCount > 0 ? 'amber' : 'green'}
        />
        <ReadinessCard
          title="Services"
          value={serviceVisibility ? 'Visible' : 'Hidden'}
          detail="Public Services navigation and pages."
          href="/admin/settings"
          action="Open settings"
          tone={serviceVisibility ? 'green' : 'stone'}
        />
        <ReadinessCard
          title="Commission"
          value={`${commissionPercent}%`}
          detail="Rate locked onto new bookings."
          href="/admin/settings"
          action="Open settings"
          tone={commissionPercent === '0' ? 'stone' : 'green'}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-stone-950">Launch checklist</h3>
              <p className="mt-1 text-sm text-stone-600">
                Keep this list boring before launch. Boring is good here.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${launchBlockers > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
              {launchBlockers > 0 ? `${launchBlockers} areas need attention` : 'Ready-looking'}
            </span>
          </div>

          <div className="mt-5 divide-y divide-stone-100">
            <ChecklistItem
              label="Services visibility reviewed"
              complete={serviceVisibility === false}
              helper={serviceVisibility ? 'Services are public. Hide them if not launch ready.' : 'Services are hidden from public navigation.'}
              href="/admin/settings"
            />
            <ChecklistItem
              label="Commission reviewed"
              complete={commissionPercent === '0'}
              helper={`Current commission is ${commissionPercent}%.`}
              href="/admin/settings"
            />
            <ChecklistItem
              label="At least one live listing"
              complete={liveListings.length > 0}
              helper={`${liveListings.length} live listing${liveListings.length === 1 ? '' : 's'} available.`}
              href="/admin/listings?published=live"
            />
            <ChecklistItem
              label="No live listings missing photos"
              complete={liveListingsMissingPhotos.length === 0}
              helper={`${liveListingsMissingPhotos.length} live listing${liveListingsMissingPhotos.length === 1 ? '' : 's'} need more photos.`}
              href="/admin/listings?published=live"
            />
            <ChecklistItem
              label="No live listings missing price"
              complete={liveListingsMissingPrice.length === 0}
              helper={`${liveListingsMissingPrice.length} live listing${liveListingsMissingPrice.length === 1 ? '' : 's'} need pricing.`}
              href="/admin/listings?published=live"
            />
            <ChecklistItem
              label="No live listings missing sleeping setup"
              complete={liveListingsMissingSleepingSetup.length === 0}
              helper={`${liveListingsMissingSleepingSetup.length} live listing${liveListingsMissingSleepingSetup.length === 1 ? '' : 's'} need sleeping arrangements.`}
              href="/admin/listings?published=live"
            />
            <ChecklistItem
              label="No live listings missing capacity"
              complete={liveListingsMissingCapacity.length === 0}
              helper={`${liveListingsMissingCapacity.length} live listing${liveListingsMissingCapacity.length === 1 ? '' : 's'} need bedroom or guest capacity details.`}
              href="/admin/listings?published=live"
            />
            <ChecklistItem
              label="Pending applications reviewed"
              complete={(pendingApplicationsCount || 0) === 0}
              helper={`${pendingApplicationsCount || 0} application${pendingApplicationsCount === 1 ? '' : 's'} pending.`}
              href="/admin/applications"
            />
          </div>
        </div>

        <aside className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold text-stone-950">Fast actions</h3>
          <div className="mt-4 divide-y divide-stone-100">
            <ActionLink href="/admin/listings/new" title="Create listing" detail="Add a stay for a host." />
            <ActionLink href="/admin/listings" title="Manage listings" detail="Publish, hide, feature, or remove." />
            <ActionLink href="/admin/hosts" title="Manage hosts" detail="Verify or block listing access." />
            <ActionLink href="/admin/applications" title="Review applications" detail="Approve, reject, or request changes." />
            <ActionLink href="/admin/audit" title="Audit history" detail="See admin activity." />
          </div>
        </aside>
      </section>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-stone-950">Listing quality watchlist</h3>
            <p className="mt-1 text-sm text-stone-600">
              Live listings that may feel unfinished to guests.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${weakListings.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
            {weakListings.length > 0 ? `${weakListings.length} need attention` : 'All live listings checked'}
          </span>
        </div>

        <div className="mt-5 divide-y divide-stone-100">
          {weakListings.map((listing) => (
            <Link
              key={listing.id}
              href={`/admin/listings/${listing.id}`}
              className="grid gap-3 py-4 transition hover:text-[#c76f55] md:grid-cols-[1fr_120px_1.2fr]"
            >
              <span>
                <span className="block font-bold text-stone-950">{listing.title}</span>
                <span className="mt-1 block text-sm text-stone-500">{listing.area || 'Jerusalem'}</span>
              </span>
              <span className="text-sm font-semibold text-stone-700">
                {listing.photoCount} photo{listing.photoCount === 1 ? '' : 's'}
              </span>
              <span className="flex flex-wrap gap-2">
                {listing.issues.map((issue) => (
                  <span key={issue} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                    {issue}
                  </span>
                ))}
              </span>
            </Link>
          ))}
          {weakListings.length === 0 && (
            <p className="py-8 text-center text-sm text-stone-500">
              No weak live listings found.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

function countPhotosByListing(photos: ListingPhotoRow[]) {
  const counts = new Map<string, number>()

  photos.forEach((photo) => {
    if (!photo.listing_id) return
    counts.set(photo.listing_id, (counts.get(photo.listing_id) || 0) + 1)
  })

  return counts
}

function ReadinessCard({
  title,
  value,
  detail,
  href,
  action,
  tone,
}: {
  title: string
  value: number | string
  detail: string
  href: string
  action: string
  tone: ReadinessTone
}) {
  const toneClass = {
    green: 'border-green-100 bg-green-50 text-green-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    stone: 'border-stone-100 bg-stone-50 text-stone-600',
  }[tone]

  return (
    <article className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-stone-500">{title}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-stone-950">{value}</p>
      <p className="mt-2 min-h-10 text-sm leading-5 text-stone-600">{detail}</p>
      <Link
        href={href}
        className={`mt-4 inline-flex rounded-full border px-3 py-1.5 text-xs font-bold transition hover:bg-white ${toneClass}`}
      >
        {action}
      </Link>
    </article>
  )
}

function ChecklistItem({
  label,
  complete,
  helper,
  href,
}: {
  label: string
  complete: boolean
  helper: string
  href: string
}) {
  return (
    <Link href={href} className="flex items-start gap-3 py-4 transition hover:text-[#c76f55]">
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${complete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
        {complete ? 'OK' : '!'}
      </span>
      <span>
        <span className="block font-bold text-stone-950">{label}</span>
        <span className="mt-1 block text-sm text-stone-600">{helper}</span>
      </span>
    </Link>
  )
}

function ActionLink({
  href,
  title,
  detail,
}: {
  href: string
  title: string
  detail: string
}) {
  return (
    <Link href={href} className="block py-4 transition hover:text-[#c76f55]">
      <p className="font-bold text-stone-950">{title}</p>
      <p className="mt-1 text-sm text-stone-600">{detail}</p>
    </Link>
  )
}
