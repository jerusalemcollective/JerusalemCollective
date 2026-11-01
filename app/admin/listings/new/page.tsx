import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'
import { createAdminListing } from '@/app/admin/listing-actions'
import { AdminActionForm } from '@/components/admin-confirm-action-form'

type HostOption = {
  id: string
  name: string | null
  email: string | null
}

type PlatformPersonRow = {
  email: string | null
  full_name: string | null
  host_id: string | null
  host_name: string | null
}

export default async function NewAdminListingPage() {
  const { supabase } = await requireAdminPermission('listings')

  // Only real hosts: signed-up users who have a hosts row. list_platform_people
  // joins auth.users to hosts, which also gives us the account email (hosts.email
  // is not readable by the admin role after migration 074).
  const { data: people, error: peopleError } = await supabase.rpc('list_platform_people')
  if (peopleError) console.error('Could not load hosts for the create-listing picker', peopleError)

  const hostsById = new Map<string, HostOption>()
  for (const person of (people || []) as PlatformPersonRow[]) {
    if (!person.host_id || hostsById.has(person.host_id)) continue
    hostsById.set(person.host_id, {
      id: person.host_id,
      name: person.host_name || person.full_name,
      email: person.email,
    })
  }

  const { data: blockedHosts } = hostsById.size
    ? await supabase.from('hosts').select('id').in('id', [...hostsById.keys()]).eq('listing_blocked', true)
    : { data: [] }
  const blockedIds = new Set(((blockedHosts || []) as { id: string }[]).map((host) => host.id))

  const availableHosts = [...hostsById.values()]
    .filter((host) => !blockedIds.has(host.id))
    .sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''))

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">
        <Link href="/admin/listings" className="hover:text-[#c76f55]">Listings</Link>
        <span>/</span>
        <span className="text-stone-900">Create listing</span>
      </div>

      <section className="max-w-3xl rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
          Platform admin
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold text-stone-950">Create listing</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Create a basic listing for a host. Photos, house rules, calendar, and richer details can be added after creation.
        </p>

        <AdminActionForm
          action={createAdminListing}
          submitLabel="Create listing"
          pendingLabel="Creating..."
          className="mt-8 space-y-5"
          submitClassName="ml-auto block rounded-full bg-stone-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-stone-800"
        >
          <label className="block">
            <span className="text-sm font-semibold text-stone-800">Host</span>
            <select name="hostId" required className={inputClass}>
              <option value="">Select a host...</option>
              {availableHosts.map((host) => (
                <option key={host.id} value={host.id}>
                  {[host.name || 'Unnamed host', host.email].filter(Boolean).join(' — ')}
                </option>
              ))}
            </select>
            {peopleError && (
              <span role="alert" className="mt-2 block text-xs leading-5 text-red-700">
                The host list could not be loaded. Please refresh the page.
              </span>
            )}
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Title" name="title" required />
            <Field label="Area" name="area" required />
          </div>

          <Field label="Exact address" name="exactAddress" />

          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Bedrooms" name="bedrooms" type="number" min="0" defaultValue="0" />
            <Field label="Bathrooms" name="bathrooms" type="number" min="0" step="0.5" />
            <Field label="Max guests" name="maxGuests" type="number" min="1" defaultValue="1" />
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-stone-800">Sleeping setup</span>
            <textarea
              name="sleepingSetup"
              rows={5}
              placeholder={`Example:\nBedroom 1: king bed\nBedroom 2: two single beds\nLiving room: sofa bed`}
              className={`${inputClass} resize-y`}
            />
            <span className="mt-2 block text-xs leading-5 text-stone-500">
              Add the plain-English sleeping arrangement guests will see on the listing.
            </span>
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Price ILS" name="priceIls" type="number" min="0" />
            <Field label="Price USD" name="priceUsd" type="number" min="0" />
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-stone-800">Booking type</span>
            <select name="bookingType" defaultValue="request" className={inputClass}>
              <option value="request">Booking request</option>
              <option value="instant">Instant book</option>
            </select>
          </label>

          <label className="flex items-start gap-3 rounded-2xl bg-[#F8F5F2] p-4 text-sm text-stone-600">
            <input type="checkbox" name="onlinePaymentEnabled" className="mt-1" />
            <span>
              <span className="block font-bold text-stone-950">Allow Book now with JLM payment</span>
              <span className="mt-1 block text-xs leading-5 text-stone-500">
                Guests can pay JLM Collective online. Host payout stays in the currency received where supported.
              </span>
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-stone-800">Description</span>
            <textarea name="description" rows={5} className={`${inputClass} resize-y`} />
          </label>

          <label className="flex items-start gap-3 rounded-2xl bg-[#F8F5F2] p-4 text-sm text-stone-600">
            <input type="checkbox" name="isPublished" className="mt-1" />
            <span>
              <span className="block font-bold text-stone-950">Publish immediately</span>
              <span className="mt-1 block text-xs leading-5 text-stone-500">
                Leave unchecked to create this as a hidden draft.
              </span>
            </span>
          </label>

        </AdminActionForm>
      </section>
    </div>
  )
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
  min,
  step,
  defaultValue,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  min?: string
  step?: string
  defaultValue?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-stone-800">
        {label} {required && <span className="text-[#c76f55]">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        min={min}
        step={step}
        defaultValue={defaultValue}
        className={inputClass}
      />
    </label>
  )
}

const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]'
