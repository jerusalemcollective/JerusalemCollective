import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HostDashboardNav } from '@/components/host-dashboard-nav'
import { ExternalCalendarSyncForm } from '@/components/external-calendar-sync-form'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { updateHostListing } from '../actions'
import { ListingAiAssistant } from '@/components/listing-ai-assistant'
import { AmenitySelector } from '@/components/amenity-selector'

export default async function HostListingEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, hostIds } = await requireHostDashboardAccess()
  const [{ data: listing }, { data: adminMessages }] = await Promise.all([
    supabase
      .from('listings')
      .select(
        'id, title, area, bedrooms, bathrooms, max_guests, price_ils, price_usd, booking_type, amenities, description, house_rules, welcome_message, check_in_instructions, is_published, external_calendar_url, calendar_last_synced_at',
      )
      .eq('id', id)
      .in('host_id', hostIds)
      .single(),
    supabase
      .from('listing_admin_messages')
      .select('id, body, created_at')
      .eq('listing_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!listing) notFound()

  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">
        <HostDashboardNav />

        <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">
          <Link href="/host/dashboard/listings" className="hover:text-[#c76f55]">
            Listings
          </Link>
          <span>/</span>
          <span className="text-stone-900">{listing.title}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <form id="host-listing-edit-form" action={updateHostListing} className="space-y-6">
              <input type="hidden" name="listingId" value={listing.id} />

              <section className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Listing editor</p>
                    <h1 className="mt-2 text-3xl font-bold text-stone-950">Edit stay details</h1>
                  </div>
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${
                    listing.is_published ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-700'
                  }`}>
                    {listing.is_published ? 'Live' : 'Hidden'}
                  </span>
                </div>
              </section>

            <EditorSection title="Basics">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Title">
                  <input name="title" defaultValue={listing.title} required className={inputClass} />
                </Field>
                <Field label="Neighbourhood">
                  <input name="area" defaultValue={listing.area} required className={inputClass} />
                </Field>
              </div>
            </EditorSection>

            <EditorSection title="Capacity">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Bedrooms">
                  <input name="bedrooms" type="number" min="0" defaultValue={listing.bedrooms} className={inputClass} />
                </Field>
                <Field label="Bathrooms">
                  <input name="bathrooms" type="number" min="0" step="0.5" defaultValue={listing.bathrooms ?? ''} className={inputClass} />
                </Field>
                <Field label="Maximum guests">
                  <input name="maxGuests" type="number" min="1" defaultValue={listing.max_guests} className={inputClass} />
                </Field>
              </div>
            </EditorSection>

            <EditorSection title="Pricing and booking">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Price ILS">
                  <input name="priceIls" type="number" min="0" defaultValue={listing.price_ils ?? ''} className={inputClass} />
                </Field>
                <Field label="Price USD">
                  <input name="priceUsd" type="number" min="0" defaultValue={listing.price_usd ?? ''} className={inputClass} />
                </Field>
                <Field label="Booking style">
                  <select name="bookingType" defaultValue={listing.booking_type} className={inputClass}>
                    <option value="request">Request to book</option>
                    <option value="enquiry">Enquiry only</option>
                    <option value="instant">Instant book</option>
                  </select>
                </Field>
              </div>
            </EditorSection>

            <EditorSection title="Amenities">
              <AmenitySelector defaultSelectedAmenities={listing.amenities || []} />
            </EditorSection>

            <EditorSection title="Description">
              <div className="mb-5">
                <ListingAiAssistant
                  formId="host-listing-edit-form"
                  titleField="title"
                  areaField="area"
                  bedroomsField="bedrooms"
                  bathroomsField="bathrooms"
                  guestsField="maxGuests"
                  amenitiesField="amenities"
                  descriptionField="description"
                />
              </div>
              <textarea
                name="description"
                defaultValue={listing.description || ''}
                rows={8}
                className={`${inputClass} resize-y`}
              />
            </EditorSection>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-stone-950">Guest communication</h2>
              <p className="mt-1 text-sm text-stone-600">
                These messages are shared with guests at the right moment automatically.
              </p>

              <label className="mt-5 block text-sm font-semibold text-stone-700">
                House rules
                <span className="ml-2 text-xs font-normal text-stone-400">
                  Shown to guests before they enquire
                </span>
                <textarea
                  name="houseRules"
                  rows={4}
                  defaultValue={listing.house_rules || ''}
                  placeholder="e.g. No smoking. Shabbat-observant property. Please remove shoes at the entrance."
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400"
                />
              </label>

              <label className="mt-4 block text-sm font-semibold text-stone-700">
                Welcome message
                <span className="ml-2 text-xs font-normal text-stone-400">
                  Sent when a booking is confirmed
                </span>
                <textarea
                  name="welcomeMessage"
                  rows={4}
                  defaultValue={listing.welcome_message || ''}
                  placeholder="e.g. Welcome to our home. We hope you have a wonderful stay. Please make yourself comfortable."
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400"
                />
              </label>

              <label className="mt-4 block text-sm font-semibold text-stone-700">
                Check-in instructions
                <span className="ml-2 text-xs font-normal text-stone-400">
                  Shared once booking is confirmed
                </span>
                <textarea
                  name="checkInInstructions"
                  rows={5}
                  defaultValue={listing.check_in_instructions || ''}
                  placeholder="e.g. Check-in is from 3pm. The key box is to the right of the front door. Code: ****"
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400"
                />
              </label>
            </section>

            {!!adminMessages?.length && (
              <EditorSection title="Messages from JLM Collective">
                <div className="space-y-3">
                  {adminMessages.map((message) => (
                    <article key={message.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
                        Message from JLM Collective
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-900">
                        {message.body}
                      </p>
                    </article>
                  ))}
                </div>
              </EditorSection>
            )}

              <div className="flex justify-end">
                <button className="rounded-full bg-[#c76f55] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#b85f47]">
                  Save changes
                </button>
              </div>
            </form>

            <ExternalCalendarSyncForm
              listingId={listing.id}
              externalCalendarUrl={listing.external_calendar_url || null}
              calendarLastSyncedAt={listing.calendar_last_synced_at || null}
            />
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-stone-950">Quick actions</h2>
              <div className="mt-4 grid gap-2">
                <Link
                  href={`/listings/${listing.id}`}
                  className="rounded-2xl bg-[#252525] px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-[#111111]"
                >
                  View public page
                </Link>
                <Link
                  href="/become-a-host"
                  className="rounded-2xl border border-stone-200 px-4 py-3 text-center text-sm font-bold text-stone-700 transition hover:border-stone-300"
                >
                  Add another stay
                </Link>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-stone-950">Good to know</h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                You can update the guest-facing details here. Publication, featuring, and verification remain managed by the JLM Collective team.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

function EditorSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-stone-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-stone-800">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-[#c76f55]'
