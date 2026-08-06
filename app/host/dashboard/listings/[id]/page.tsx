import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { getPaymentRouteSettings } from '@/lib/platform-settings'
import { allNeighborhoods } from '@/lib/neighborhoods'
import { updateHostListing, deleteHostListing } from '../actions'
import { ConfirmSubmitButton } from '@/components/confirm-submit-button'
import { DepositFields } from '@/components/deposit-fields'
import { ListingAiAssistant } from '@/components/listing-ai-assistant'
import { AmenitySelector } from '@/components/amenity-selector'
import { ListingPhotoManager } from '@/components/listing-photo-manager'
import { StickySaveBar } from '@/components/sticky-save-bar'

type HostPaymentProfile = {
  commission_percent_override: number | null
}

type ListingPhotoRow = {
  id: string
  photo_url: string
  storage_path: string | null
  is_cover: boolean
  sort_order: number
  label: string | null
}

export default async function HostListingEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, hostIds } = await requireHostDashboardAccess()
  const [{ data: listing }, { data: adminMessages }, { data: photos }, paymentRoutes, { data: paymentProfile }] =
    await Promise.all([
      supabase
        .from('listings')
        .select(
          'id, title, area, bedrooms, bathrooms, max_guests, sleeping_setup, price_ils, price_usd, booking_type, online_payment_enabled, amenities, description, house_rules, welcome_message, check_in_instructions, is_published, shabbat_elevator, physical_key_entry, shabbat_clock, kosher_kitchen_level, walking_minutes_to_kotel, near_synagogue, sukkah_balcony, american_comfort, central_ac, american_washer_dryer, american_mattress, powerful_water_heater, deposit_type, deposit_value, balance_due_days_before_checkin, confirm_requirement',
        )
        .eq('id', id)
        .in('host_id', hostIds)
        .single(),
      supabase
        .from('listing_admin_messages')
        .select('id, body, created_at')
        .eq('listing_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('listing_photos')
        .select('id, photo_url, storage_path, is_cover, sort_order, label')
        .eq('listing_id', id)
        .order('sort_order', { ascending: true }),
      getPaymentRouteSettings(),
      supabase
        .from('host_payment_profiles')
        .select('commission_percent_override')
        .in('host_id', hostIds)
        .limit(1)
        .maybeSingle<HostPaymentProfile>(),
    ])

  if (!listing) notFound()

  const depositCurrency = listing.price_usd != null ? 'USD' : 'ILS'
  const effectiveCommissionPercent = paymentProfile?.commission_percent_override ?? paymentRoutes.commissionPercent
  const jlmPaymentDescription = getJlmPaymentDescription(effectiveCommissionPercent)
  const listingPhotos = (photos || []) as ListingPhotoRow[]

  return (
    <div className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-3xl">

        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-stone-500">
          <Link href="/host/dashboard/listings" className="hover:text-[#c76f55]">
            Listings
          </Link>
          <span>/</span>
          <span className="text-stone-900">{listing.title}</span>
          <span className={`ml-1 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
            listing.is_published ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-700'
          }`}>
            {listing.is_published ? 'Live' : 'Hidden'}
          </span>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Link
            href={`/listings/${listing.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-700 transition hover:border-stone-300"
          >
            View live ↗
          </Link>
          <Link
            href="/host/dashboard/messages"
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-700 transition hover:border-stone-300"
          >
            Messages
          </Link>
          <form action={deleteHostListing}>
            <input type="hidden" name="listingId" value={listing.id} />
            <ConfirmSubmitButton
              message="Delete this stay permanently? This cannot be undone. If it already has bookings you will be asked to hide it instead, so your records stay intact."
              className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
            >
              Delete
            </ConfirmSubmitButton>
          </form>
        </div>

        <form id="host-listing-edit-form" action={updateHostListing} className="space-y-6">
          <input type="hidden" name="listingId" value={listing.id} />

          {/* 1. Stay details — title, description, neighbourhood, capacity */}
          <EditorSection title="Stay details">
            <Field label="Title">
              <input name="title" defaultValue={listing.title} required dir="auto" className={inputClass} />
            </Field>

            <div className="mt-5">
              <Field label="Description">
                <div className="mb-3 mt-2">
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
                  dir="auto"
                  className={`${inputClass} resize-y`}
                />
              </Field>
            </div>

            <div className="mt-5">
              <Field label="Neighbourhood">
                <input
                  name="area"
                  defaultValue={listing.area}
                  required
                  list="neighbourhood-options"
                  className={inputClass}
                />
                <datalist id="neighbourhood-options">
                  {allNeighborhoods.map((neighbourhood) => (
                    <option key={neighbourhood} value={neighbourhood} />
                  ))}
                </datalist>
              </Field>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
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
            </div>
          </EditorSection>

          {/* 2. Photos */}
          <EditorSection title="Photos">
            <ListingPhotoManager listingId={listing.id} initialPhotos={listingPhotos} />
          </EditorSection>

          {/* 3. Amenities */}
          <EditorSection title="Amenities">
            <AmenitySelector defaultSelectedAmenities={listing.amenities || []} name="amenities" />

            <div className="mt-6 border-t border-stone-100 pt-6">
              <h3 className="text-sm font-bold text-stone-950">Kosher and Shabbos</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Kosher kitchen level">
                  <select name="kosherKitchenLevel" defaultValue={listing.kosher_kitchen_level || ''} className={inputClass}>
                    <option value="">Select level</option>
                    <option value="kosher">Kosher</option>
                    <option value="mehadrin">Mehadrin</option>
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
                  Building has a Shabbos elevator
                </CheckboxField>
                <CheckboxField name="physicalKeyEntry" defaultChecked={Boolean(listing.physical_key_entry)}>
                  Property uses a physical key (no digital keypad or smartlock)
                </CheckboxField>
                <CheckboxField name="shabbatClock" defaultChecked={Boolean(listing.shabbat_clock)}>
                  Apartment has a Shabbos clock or timer for lights
                </CheckboxField>
                <CheckboxField name="sukkahBalcony" defaultChecked={Boolean(listing.sukkah_balcony)}>
                  Has a balcony suitable for a sukkah
                </CheckboxField>
                <CheckboxField name="nearSynagogue" defaultChecked={Boolean(listing.near_synagogue)}>
                  Within 5 minutes walk of a shul
                </CheckboxField>
              </div>
            </div>

            <div className="mt-6 border-t border-stone-100 pt-6">
              <h3 className="text-sm font-bold text-stone-950">Comfort</h3>
              <p className="mt-1 text-sm text-stone-600">
                North American guests often specifically look for these.
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
            </div>
          </EditorSection>

          {/* 4. Pricing and booking (incl. deposit) */}
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

            <DepositFields
              depositType={listing.deposit_type || 'percent'}
              depositValue={Number(listing.deposit_value ?? 10)}
              balanceDueDays={Number(listing.balance_due_days_before_checkin ?? 0)}
              currency={depositCurrency}
            />

            <Field label="Confirm a booking">
              <select
                name="confirmRequirement"
                defaultValue={listing.confirm_requirement === 'deposit' ? 'deposit' : 'on_accept'}
                className={inputClass}
              >
                <option value="on_accept">As soon as I accept the request</option>
                <option value="deposit">After I&apos;ve received the deposit</option>
              </select>
            </Field>
          </EditorSection>

          {/* 5. Guest info */}
          <EditorSection title="Guest info">
            <label className="block text-sm font-semibold text-stone-800">
              House rules
              <textarea
                name="houseRules"
                rows={4}
                defaultValue={listing.house_rules || ''}
                placeholder="e.g. No smoking. Shabbos-observant property. Please remove shoes at the entrance."
                className={`${inputClass} resize-y`}
              />
            </label>

            <label className="mt-5 block text-sm font-semibold text-stone-800">
              Welcome message
              <textarea
                name="welcomeMessage"
                rows={4}
                defaultValue={listing.welcome_message || ''}
                placeholder="e.g. Welcome to our home. We hope you have a wonderful stay. Please make yourself comfortable."
                className={`${inputClass} resize-y`}
              />
            </label>

            <label className="mt-5 block text-sm font-semibold text-stone-800">
              Check-in instructions
              <textarea
                name="checkInInstructions"
                rows={5}
                defaultValue={listing.check_in_instructions || ''}
                placeholder="e.g. Check-in is from 3pm. The key box is to the right of the front door. Code: ****"
                className={`${inputClass} resize-y`}
              />
            </label>
          </EditorSection>

          {/* 6. Messages from JLM Collective */}
          <EditorSection title="Messages from JLM Collective">
            {adminMessages?.length ? (
              <div className="space-y-3">
                {adminMessages.map((message) => (
                  <article key={message.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-amber-900">
                      {message.body}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-amber-700">
                      {new Date(message.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-500">
                No messages from the JLM Collective team yet. Anything they send about this stay will appear here.
              </p>
            )}
          </EditorSection>

          <StickySaveBar formId="host-listing-edit-form" />
        </form>
      </section>
    </div>
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
