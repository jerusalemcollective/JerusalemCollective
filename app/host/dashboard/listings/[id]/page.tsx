import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { getPaymentRouteSettings } from '@/lib/platform-settings'
import { currencyName, hostCurrencyFromProfile } from '@/lib/currencies'
import { allNeighborhoods } from '@/lib/neighborhoods'
import { updateHostListing } from '../actions'
import { HostListingVisibilityDelete } from '@/components/host-listing-visibility-delete'
import {
  DepositCancellationFields,
  depositCancellationDraftFrom,
} from '@/components/deposit-cancellation-fields'
import { MinNightsField } from '@/components/min-nights-field'
import { ListingAiAssistant } from '@/components/listing-ai-assistant'
import { AmenitySelector } from '@/components/amenity-selector'
import { ShabbosAmenities } from '@/components/shabbos-amenities'
import { SleepingSetupBuilder } from '@/components/sleeping-setup-builder'
import { ListingPhotoManager } from '@/components/listing-photo-manager'
import { SaveStateForm, StickySaveBar } from '@/components/sticky-save-bar'
import { BookingStyleField } from '@/components/booking-style-field'
import { StayTermsFields } from '@/components/stay-terms-fields'
import { STAY_TERMS_COLUMNS, stayTermsFromResult } from '@/lib/stay-terms'

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
  const { supabase, hostIds, user } = await requireHostDashboardAccess()
  const [
    { data: listing },
    { data: adminMessages },
    { data: photos },
    paymentRoutes,
    { data: paymentProfile },
    { count: bookingCount },
    { count: requestCount },
    stayTermsResult,
    { data: ownProfile },
  ] =
    await Promise.all([
      supabase
        .from('listings')
        .select(
          'id, title, area, bedrooms, bathrooms, max_guests, sleeping_setup, price_ils, price_usd, price, price_currency, included_guests, extra_guest_fee_ils, extra_guest_fee_usd, extra_guest_fee, booking_type, online_payment_enabled, amenities, description, house_rules, welcome_message, check_in_instructions, is_published, shabbat_elevator, physical_key_entry, shabbat_clock, kosher_kitchen_level, walking_minutes_to_kotel, near_synagogue, sukkah_balcony, deposit_type, deposit_value, balance_due_days_before_checkin, deposit_due_days_before_checkin, min_nights',
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
      // Bookings / requests decide whether Delete is offered (the delete action
      // checks again on the server before removing anything).
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('listing_id', id),
      supabase.from('booking_requests').select('id', { count: 'exact', head: true }).eq('listing_id', id),
      // Read separately so the editor still loads before migration 118 adds these columns.
      supabase
        .from('listings')
        .select(STAY_TERMS_COLUMNS.join(', '))
        .eq('id', id)
        .in('host_id', hostIds)
        .maybeSingle(),
      // The host's currency lives on their profile only.
      supabase.from('profiles').select('preferred_currency').eq('id', user.id).maybeSingle(),
    ])

  if (!listing) notFound()

  // Only decides what to show: the delete action re-checks on the server and
  // refuses (deleting nothing) if its own check fails.
  const hasBookingHistory = (bookingCount || 0) > 0 || (requestCount || 0) > 0

  const hostCurrency = hostCurrencyFromProfile(ownProfile?.preferred_currency)
  const listingCurrency = listing.price_currency || (listing.price_usd != null ? 'USD' : 'ILS')
  // Saving prices this listing in the profile currency, so warn when it is
  // currently in another one: the number is kept, not converted.
  const currencyChanges = listingCurrency !== hostCurrency.currency
  const effectiveCommissionPercent = paymentProfile?.commission_percent_override ?? paymentRoutes.commissionPercent
  const jlmPaymentDescription = getJlmPaymentDescription(effectiveCommissionPercent)
  const listingPhotos = (photos || []) as ListingPhotoRow[]
  const stayTerms = stayTermsFromResult(stayTermsResult)

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
        </div>

        <HostListingVisibilityDelete
          listingId={listing.id}
          isPublished={Boolean(listing.is_published)}
          hasBookingHistory={hasBookingHistory}
        />

        <SaveStateForm id="host-listing-edit-form" action={updateHostListing} className="space-y-6">
          <input type="hidden" name="listingId" value={listing.id} />

          {/* 1. Stay details — title, description, neighbourhood, capacity */}
          <EditorSection title="Stay details">
            <Field label="Title">
              <input name="title" defaultValue={listing.title} required dir="auto" className={inputClass} />
            </Field>

            <div className="mt-5">
              <Field label="Description">
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

            <div className="mt-5">
              <Field label="Sleeping setup">
                <SleepingSetupBuilder
                  name="sleepingSetup"
                  defaultValue={listing.sleeping_setup || ''}
                  fillFields={{ bedrooms: 'bedrooms', sleeps: 'maxGuests' }}
                />
              </Field>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <input type="hidden" name="bedrooms" defaultValue={listing.bedrooms ?? ''} />
              <input type="hidden" name="maxGuests" defaultValue={listing.max_guests ?? ''} />
              <Field label="Bathrooms">
                <input name="bathrooms" type="number" min="0" step="0.5" defaultValue={listing.bathrooms ?? ''} className={inputClass} />
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

            <div className="mt-5">
              <ShabbosAmenities
                values={{
                  kosherKitchenLevel: listing.kosher_kitchen_level || '',
                  walkingMinutesToKotel: listing.walking_minutes_to_kotel == null ? '' : String(listing.walking_minutes_to_kotel),
                  shabbatElevator: Boolean(listing.shabbat_elevator),
                  shabbatClock: Boolean(listing.shabbat_clock),
                  nearSynagogue: Boolean(listing.near_synagogue),
                  sukkahBalcony: Boolean(listing.sukkah_balcony),
                  physicalKeyEntry: Boolean(listing.physical_key_entry),
                  amenities: listing.amenities || [],
                }}
              />
            </div>

            <div className="mt-6 border-t border-stone-100 pt-6">
              <h3 className="text-sm font-bold text-stone-950">Polish your description</h3>
              <p className="mt-1 text-xs text-stone-500">
                AI rewrites the title and description in Stay details, using the amenities above. It does not add anything new.
              </p>
              <div className="mt-3">
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
            </div>

          </EditorSection>

          {/* 4. Pricing and booking (incl. deposit) */}
          <EditorSection title="Pricing and booking">
            <input type="hidden" name="priceCurrency" value={hostCurrency.currency} />
            <Field label="Price per night">
              <div className="mt-2 flex overflow-hidden rounded-2xl border border-stone-200 bg-white focus-within:border-[#c76f55]">
                <span className="flex items-center border-r border-stone-200 bg-[#F8F5F2] px-4 text-sm font-bold text-stone-600">
                  {hostCurrency.currency}
                </span>
                <input
                  name="price"
                  type="number"
                  min="0"
                  defaultValue={listing.price ?? listing.price_usd ?? listing.price_ils ?? ''}
                  className="w-full bg-transparent px-4 py-3 text-stone-900 outline-none"
                />
              </div>
            </Field>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              Prices are in your currency, {currencyName(hostCurrency.currency)}.{' '}
              <Link href="/profile" className="font-semibold text-[#c76f55] hover:underline">
                Change it in your profile
              </Link>
              .
            </p>
            {!hostCurrency.supported && (
              <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                Your profile currency ({ownProfile?.preferred_currency}) can’t be used for listing prices, so this
                listing is priced in {hostCurrency.currency}. Choose ILS, USD, GBP, EUR, CAD, CHF or AUD in your profile.
              </p>
            )}
            {currencyChanges && (
              <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                This listing is priced in {listingCurrency}. When you save, its prices switch to{' '}
                {hostCurrency.currency} without converting the numbers. Check the price per night, the extra
                guest fee and any fixed deposit before saving.
              </p>
            )}
            <BookingStyleField defaultValue={listing.booking_type} />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Price includes up to (guests)">
                <input name="includedGuests" type="number" min="1" defaultValue={listing.included_guests ?? listing.max_guests ?? ''} className={inputClass} />
              </Field>
              <Field label="Extra guest fee (per night)">
                <input
                  name="extraGuestFee"
                  type="number"
                  min="0"
                  defaultValue={listing.extra_guest_fee ?? listing.extra_guest_fee_usd ?? listing.extra_guest_fee_ils ?? 0}
                  className={inputClass}
                />
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
                  <span className="block font-bold text-stone-950">Take card payment through JLM</span>
                  <span className="mt-1 block text-sm leading-6 text-stone-600">
                    Guests can pay JLM Collective online for this listing. {jlmPaymentDescription} Card checkout is
                    used with Instant book; request-to-book stays are paid to you directly after you accept.
                  </span>
                </span>
              </label>
            ) : (
              <input type="hidden" name="onlinePaymentEnabled" value="" />
            )}

            <DepositCancellationFields
              initial={depositCancellationDraftFrom(listing, stayTerms.terms)}
              currency={hostCurrency.currency}
              cancellationAvailable={stayTerms.available}
            />
          </EditorSection>

          {/* 5. Stay rules */}
          <EditorSection title="Stay rules">
            <MinNightsField minNights={Number(listing.min_nights ?? 1)} className="block" />

            <StayTermsFields
              terms={stayTerms.terms}
              available={stayTerms.available}
              unavailableNote="Check-in and check-out times and the cancellation rule can be set here once the latest database update has run."
            />

          </EditorSection>

          {/* 6. Guest info */}
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

          {/* 7. Messages from JLM Collective */}
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
        </SaveStateForm>
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
