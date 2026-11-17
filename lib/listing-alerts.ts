import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { mergeChangeSets, type ListingChangeSet } from '@/lib/utils/listing-changes'
import { sendAdminListingEditedEmail, sendAdminListingPhotosChangedEmail } from '@/lib/transactional-email'

// Rate limits for the "host changed their live listing" emails to the JLM team.
//
//   * Details: the first change emails straight away. Changes saved in the
//     next 15 minutes are kept in listing_alert_state.edit_alert_pending and
//     go out, merged, with the next save after the 15 minutes are up.
//   * Photos: at most one email per listing per hour; changes in between are
//     not emailed (the team sees the current photos when they look).
//
// The timestamps live in public.listing_alert_state (migration 123), which only
// the service role can use. Until 123 has been run, or without a service key,
// a per-server-instance memory is used instead: best effort, never a failure.
//
// Callers must only use these for changes a host made themselves, and must
// never let them throw into the host's action (they don't: every path is
// caught and logged).

const EDIT_WINDOW_MS = 15 * 60 * 1000
const PHOTOS_WINDOW_MS = 60 * 60 * 1000

type AlertStateRow = {
  listing_id: string
  edit_alert_sent_at: string | null
  edit_alert_pending: ListingChangeSet | null
  photos_alert_sent_at: string | null
}

type TimestampColumn = 'edit_alert_sent_at' | 'photos_alert_sent_at'

const memoryLastSent = new Map<string, number>()

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createServiceRoleClient(url, key) : null
}

function isMissingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    (error.message || '').includes('listing_alert_state')
  )
}

// Memory fallback: true (and records now) if nothing was sent in the window.
function claimInMemory(key: string, windowMs: number) {
  const now = Date.now()
  const last = memoryLastSent.get(key)
  if (last && now - last < windowMs) return false
  memoryLastSent.set(key, now)
  return true
}

// Claims the right to send for this listing: sets `column` to now (and
// `alsoSet`) if it was empty or older than the window, in one conditional
// write so two saves at the same moment can't both send. Returns 'claimed', 'recent' (sent within
// the window; `row` is the current state) or 'unavailable' (no table).
async function claimSend(
  admin: SupabaseClient,
  listingId: string,
  column: TimestampColumn,
  windowMs: number,
  alsoSet: Record<string, unknown> = {},
): Promise<{ result: 'claimed' | 'recent' | 'unavailable'; row: AlertStateRow | null }> {
  const { data: row, error } = await admin
    .from('listing_alert_state')
    .select('listing_id, edit_alert_sent_at, edit_alert_pending, photos_alert_sent_at')
    .eq('listing_id', listingId)
    .maybeSingle<AlertStateRow>()

  if (error) {
    if (isMissingTable(error)) return { result: 'unavailable', row: null }
    throw error
  }

  const nowIso = new Date().toISOString()

  if (!row) {
    const { error: insertError } = await admin
      .from('listing_alert_state')
      .insert({ listing_id: listingId, [column]: nowIso })
    if (!insertError) return { result: 'claimed', row: null }
    // Someone else created the row a moment ago: treat as just sent.
    if (insertError.code === '23505') return { result: 'recent', row: null }
    if (isMissingTable(insertError)) return { result: 'unavailable', row: null }
    throw insertError
  }

  const lastSent = row[column] ? new Date(row[column] as string).getTime() : NaN
  if (!Number.isNaN(lastSent) && Date.now() - lastSent < windowMs) {
    return { result: 'recent', row }
  }

  let claim = admin
    .from('listing_alert_state')
    .update({ ...alsoSet, [column]: nowIso })
    .eq('listing_id', listingId)
  claim = row[column] ? claim.eq(column, row[column] as string) : claim.is(column, null)
  const { data: claimed, error: claimError } = await claim.select('listing_id')
  if (claimError) throw claimError
  return { result: claimed && claimed.length > 0 ? 'claimed' : 'recent', row }
}

export async function alertListingEdited({
  listingId,
  title,
  hostName,
  changes,
}: {
  listingId: string
  title: string | null
  hostName: string | null
  changes: ListingChangeSet
}) {
  try {
    if (changes.fields.length === 0) return
    const admin = serviceClient()
    const claim = admin
      ? await claimSend(admin, listingId, 'edit_alert_sent_at', EDIT_WINDOW_MS, { edit_alert_pending: null })
      : { result: 'unavailable' as const, row: null }

    if (claim.result === 'unavailable') {
      if (claimInMemory(`edit:${listingId}`, EDIT_WINDOW_MS)) {
        await sendAdminListingEditedEmail({ listingId, title, hostName, changes })
      }
      return
    }

    if (claim.result === 'recent') {
      // Keep these changes for the next email.
      if (admin) {
        const pending = mergeChangeSets(claim.row?.edit_alert_pending, changes)
        const { error } = await admin
          .from('listing_alert_state')
          .update({ edit_alert_pending: pending })
          .eq('listing_id', listingId)
        if (error) console.error('Could not keep listing changes for the next alert', listingId, error)
      }
      return
    }

    // The claim cleared the pending changes; they go out in this email.
    const merged = mergeChangeSets(claim.row?.edit_alert_pending, changes)
    await sendAdminListingEditedEmail({ listingId, title, hostName, changes: merged })
  } catch (error) {
    console.error('Could not send the listing edited alert', listingId, error)
  }
}

export async function alertListingPhotosChanged({
  listingId,
  title,
  hostName,
}: {
  listingId: string
  title: string | null
  hostName: string | null
}) {
  try {
    const admin = serviceClient()
    const claim = admin
      ? await claimSend(admin, listingId, 'photos_alert_sent_at', PHOTOS_WINDOW_MS)
      : { result: 'unavailable' as const, row: null }

    const shouldSend =
      claim.result === 'claimed' ||
      (claim.result === 'unavailable' && claimInMemory(`photos:${listingId}`, PHOTOS_WINDOW_MS))
    if (!shouldSend) return false

    return await sendAdminListingPhotosChangedEmail({ listingId, title, hostName })
  } catch (error) {
    console.error('Could not send the listing photos alert', listingId, error)
    return false
  }
}
