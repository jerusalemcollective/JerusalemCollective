import type { SupabaseClient } from '@supabase/supabase-js'

// The exact street address of a listing is private. It lives in
// public.listing_private_details (migration 120), which RLS lets only the
// listing's host, admins and guests with a confirmed booking read. The old
// listings.exact_address column is readable by anyone with the public anon key,
// so after 120 it is always NULL and must not be relied on.
//
// Every read and write of the exact address goes through this file. If
// migration 120 has not been run yet, the private table does not exist and we
// fall back to listings.exact_address, so the code can deploy before the SQL.
//
// Server-only: never pass the result to a guest-facing client component unless
// the viewer is the host, an admin, or a guest with a confirmed booking.

const PRIVATE_TABLE = 'listing_private_details'

type PostgrestLikeError = { code?: string; message?: string } | null | undefined

export function isMissingListingPrivateDetailsTable(error: PostgrestLikeError) {
  if (!error) return false
  // 42P01: undefined_table (Postgres). PGRST205: table not in PostgREST's
  // schema cache, which is what Supabase returns for a table that is missing.
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  const message = (error.message || '').toLowerCase()
  return (
    message.includes(PRIVATE_TABLE) &&
    (message.includes('does not exist') || message.includes('could not find'))
  )
}

function normalizeAddress(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export type ExactAddressRead = {
  address: string | null
  error: PostgrestLikeError
  // True when migration 120 has not run and the value came from the old column.
  usedLegacyColumn: boolean
}

// Reads one listing's exact address with the caller's client, so RLS decides
// whether they may see it (a guest without a confirmed booking gets null).
export async function readListingExactAddress(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ExactAddressRead> {
  const addresses = await readListingExactAddresses(supabase, [listingId])
  return {
    address: addresses.addresses.get(listingId) ?? null,
    error: addresses.error,
    usedLegacyColumn: addresses.usedLegacyColumn,
  }
}

export async function readListingExactAddresses(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<{ addresses: Map<string, string>; error: PostgrestLikeError; usedLegacyColumn: boolean }> {
  const addresses = new Map<string, string>()
  const ids = Array.from(new Set(listingIds.filter(Boolean)))
  if (ids.length === 0) return { addresses, error: null, usedLegacyColumn: false }

  const { data, error } = await supabase
    .from(PRIVATE_TABLE)
    .select('listing_id, exact_address')
    .in('listing_id', ids)

  if (!error) {
    for (const row of (data || []) as { listing_id: string; exact_address: string | null }[]) {
      const address = normalizeAddress(row.exact_address)
      if (address) addresses.set(row.listing_id, address)
    }
    return { addresses, error: null, usedLegacyColumn: false }
  }

  if (!isMissingListingPrivateDetailsTable(error)) {
    return { addresses, error, usedLegacyColumn: false }
  }

  // Migration 120 not run yet: the address is still on listings.
  const { data: legacyRows, error: legacyError } = await supabase
    .from('listings')
    .select('id, exact_address')
    .in('id', ids)

  for (const row of (legacyRows || []) as { id: string; exact_address: string | null }[]) {
    const address = normalizeAddress(row.exact_address)
    if (address) addresses.set(row.id, address)
  }
  return { addresses, error: legacyError, usedLegacyColumn: true }
}

// Saves (or clears, with null/empty) a listing's exact address. The caller must
// be the listing's host or an admin; RLS enforces it. Call this after the
// listing row exists, and never put exact_address in a listings insert/update.
export async function writeListingExactAddress(
  supabase: SupabaseClient,
  listingId: string,
  exactAddress: string | null | undefined,
): Promise<{ error: PostgrestLikeError; usedLegacyColumn: boolean }> {
  const address = normalizeAddress(exactAddress)

  const { error } = await supabase
    .from(PRIVATE_TABLE)
    .upsert({ listing_id: listingId, exact_address: address }, { onConflict: 'listing_id' })

  if (!error) return { error: null, usedLegacyColumn: false }
  if (!isMissingListingPrivateDetailsTable(error)) return { error, usedLegacyColumn: false }

  const { error: legacyError } = await supabase
    .from('listings')
    .update({ exact_address: address })
    .eq('id', listingId)

  return { error: legacyError, usedLegacyColumn: true }
}
