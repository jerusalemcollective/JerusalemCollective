import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HostDashboardNav } from '@/components/host-dashboard-nav'
import { ExternalCalendarSyncForm } from '@/components/external-calendar-sync-form'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { getPaymentRouteSettings } from '@/lib/platform-settings'
import { updateHostListing } from '../actions'
import { ListingAiAssistant } from '@/components/listing-ai-assistant'
import { AmenitySelector } from '@/components/amenity-selector'

type HostPaymentProfile = {
  commission_percent_override: number | null
}

export default async function HostListingEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, hostIds } = await requireHostDashboardAccess()
  const [{ data: listing }, { data: adminMessages }, paymentRoutes, { data: paymentProfile }] = await Promise.all([
    supabase
      .from('listings')
      .select(
        'id, title, area, bedrooms, bathrooms, max_guests, sleeping_setup, price_ils, price_usd, booking_type, online_payment_enabled, amenities, description, house_rules, welcome_message, check_in_instructions, is_published, external_calendar_url, calendar_last_synced_at, shabbat_elevator, physical_key_entry, shabbat_clock, kosher_kitchen_level, walking_minutes_to_kotel, near_synagogue, sukkah_balcony, american_comfort, central_ac, american_washer_dryer, american_mattress, powerful_water_heater',
      )
      .eq('id', id)
      .in('host_id', hostIds)
      .single(),
    supabase
      .from('listing_admin_messages')
      .select('id, body, created_at')
      .eq('listing_id', id)
      .order('created_at', { ascending: false }),
    getPaymentRouteSettings(),
    supabase
      .from('host_payment_profiles')
      .select('commission_percent_override')
      .in('host_id', hostIds)
      .limit(1)
      .maybeSingle<HostPaymentProfile>(),
  ])

  if (!listing) notFound()

  const effectiveCommissionPercent = paymentProfile?.commission_percent_override ?? paymentRoutes.commissionPercent
  const jlmPaymentDescription = getJlmPaymentDescription(effectiveCommissionPercent)

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
              <div className="mt-5">
                <Field label="Sleeping setup">
                  <textarea
                    name="sleepingSetup"
                    rows={5}
                    defaultValue={listing.sleeping_setup || ''}
                    placeholder={`Example:\nBedroom 1: king bed\nBedroom 2: two single beds\nLiving room: sofa bed`}
                    className={`${inputClass} resize-y`}
                  />
                </Field>
                <p className="mt-2 text-xs leading-5 text-stone-500">
                  This appears on the public listing so guests can see exactly where everyone sleeps.
                </p>
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
              {paymentRoutes.jlmPaymentsEnabled ? (
                <label className="mt-5 flex items-start gap-3 rounded-2xl bg-[#F8F5F2] p-4">
                  <input
                    type="checkbox"
                    name="onlinePaymentEnabled"
                    defaultChecked={Boolean(listing.online_payment_enabled)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-bold text-stone-950">Allow Book now with JLM payment</span>
                    <span className="mt-1 block text-sm leading-6 text-stone-600">
                      Guests can pay JLM Collective online for this listing. {jlmPaymentDescription}
                    </span>
                  </span>
                </label>
              ) : (
                <input type="hidden" name="onlinePaymentEnabled" value="" />
              )}
            </EditorSection>

            <EditorSection title="Amenities">
              <AmenitySelector defaultSelectedAmenities={listing.amenities || []} name="amenities" />
            </EditorSection>

            <EditorSection title="Jewish lifestyle features">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Kosher kitchen level">
                  <select name="kosherKitchenLevel" defaultValue={listing.kosher_kitchen_level || ''} className={inputClass}>
                    <option value="">Select level</option>
                    <option value="not_kosher">Not kosher</option>
                    <option value="kosher_friendly">Kosher-friendly</option>
                    <option value="kosher">Kosher</option>
                    <option value="glatt_kosher">Glatt kosher</option>
                    <option value="chalav_yisrael">Chalav Yisrael / Mehadrin</option>
                  </select>
                </Field>
                <Field label="Approximate walking time to the Kotel (minutes)">
                  <input
                    name="walkingMinutesToKotel"
                    type="number"
                    min="0"
                    defaultValue={listing.walking_minutes_to_kotel ?? ''}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <CheckboxField name="shabbatElevator" defaultChecked={Boolean(listing.shabbat_elevator)}>
                  Building has a Shabbat elevator
                </CheckboxField>
                <CheckboxField name="physicalKeyEntry" defaultChecked={Boolean(listing.physical_key_entry)}>
                  Property uses a physical key (no digital keypad or smartlock)
                </CheckboxField>
                <CheckboxField name="shabbatClock" defaultChecked={Boolean(listing.shabbat_clock)}>
                  Apartment has a Shabbat clock or timer for lights
                </CheckboxField>
                <CheckboxField name="sukkahBalcony" defaultChecked={Boolean(listing.sukkah_balcony)}>
                  Has a balcony suitable for a sukkah
                </CheckboxField>
                <CheckboxField name="nearSynagogue" defaultChecked={Boolean(listing.near_synagogue)}>
                  Within 5 minutes walk of a synagogue
                </CheckboxField>
              </div>
            </EditorSection>

            <EditorSection title="American comfort">
              <p className="text-sm text-stone-600">
                North American guests often specifically look for these features. Check all that apply.
              </p>
              <div className="mt-4 space-y-2">
                <CheckboxField name="centralAc" defaultChecked={Boolean(listing.central_ac)}>
                  Central air conditioning (not wall units)
                </CheckboxField>
                <CheckboxField name="americanWasherDryer" defaultChecked={Boolean(listing.american_washer_dryer)}>
                  Full-size American washer and dryer (not a combo unit)
                </CheckboxField>
                <CheckboxField name="americanMattress" defaultChecked={Boolean(listing.american_mattress)}>
                  American-style mattresses (thick, quality spring or memory foam)
                </CheckboxField>
                <CheckboxField name="powerfulWaterHeater" defaultChecked={Boolean(listing.powerful_water_heater)}>
                  Large boiler / powerful water heater (not a small dud shemesh only)
                </CheckboxField>
              </div>
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
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-500"
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
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-500"
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
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-500"
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

function CheckboxField({
  name,
  defaultChecked,
  children,
}: {
  name: string
  defaultChecked: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 rounded border-stone-300"
      />
      <span className="text-sm text-stone-700">{children}</span>
    </label>
  )
}

function getJlmPaymentDescription(commissionPercent: number) {
  if (commissionPercent > 0) {
    return `JLM Collective collects payment as agent, deducts the ${formatCommission(commissionPercent)} admin fee, and pays you in the currency received where supported.`
  }

  return 'At the moment JLM Collective is not charging hosts a platform fee, and payouts are handled in the currency received where supported.'
}

function formatCommission(value: number) {
  return `${value.toLocaleString('en-GB', {
    maximumFractionDigits: 2,
  })}%`
}

const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]'
