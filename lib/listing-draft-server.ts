// Server copy of the unfinished /become-a-host listing, so a signed-in host can
// pick it up on any device. The browser copy (localStorage + IndexedDB, see
// lib/listing-draft-photos.ts) stays the primary, instant save; this is a
// best-effort mirror in public.listing_drafts (migration 122).
//
// Draft photos go to the public 'listing-photos' bucket under
// drafts/<userId>/<random>.<ext> (owner-only write policies in 122). Their paths
// and labels are kept in the draft's data so another device can download them.
//
// Everything here fails quietly: until migration 122 has been run the table is
// missing, so we warn once in the console and carry on with the browser draft.

import type { SupabaseClient } from '@supabase/supabase-js'

export const LISTING_DRAFT_CHANGED_EVENT = 'jlm-listing-draft-changed'
const PHOTO_BUCKET = 'listing-photos'

export type ServerDraftPhoto = { path: string; label: string }

export type ServerDraftRow = {
  data: Record<string, unknown>
  step: number | null
  title: string | null
  area: string | null
  updated_at: string | null
}

let unavailable = false
// After one failed photo upload, stop trying for this page load; the photos
// stay on this device and another device is told to ask for them again.
let photoUploadsOff = false
let warned = false

function warnOnce(message: string, detail?: unknown) {
  if (warned) return
  warned = true
  console.warn(`[listing-drafts] ${message}`, detail ?? '')
}

type MaybeError = { code?: string; message?: string } | null | undefined

// The table (or its schema cache entry) doesn't exist yet: stop trying for this
// page load instead of failing on every autosave.
function noteError(error: MaybeError, action: string) {
  if (!error) return
  const message = (error.message || '').toLowerCase()
  if (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.code === 'PGRST202' ||
    (message.includes('listing_drafts') &&
      (message.includes('does not exist') || message.includes('schema cache')))
  ) {
    unavailable = true
    warnOnce('Server drafts are not set up yet (run migration 122). Using this browser only.', error)
    return
  }
  warnOnce(`Could not ${action} the server draft.`, error)
}

export function serverDraftsAvailable() {
  return !unavailable
}

export function notifyListingDraftChanged() {
  try {
    window.dispatchEvent(new Event(LISTING_DRAFT_CHANGED_EVENT))
  } catch {
    // No window (SSR) — nothing listens anyway.
  }
}

export async function fetchServerDraft(
  supabase: SupabaseClient,
  userId: string,
): Promise<ServerDraftRow | null> {
  if (unavailable) return null
  try {
    const { data, error } = await supabase
      .from('listing_drafts')
      .select('data, step, title, area, updated_at')
      .eq('user_id', userId)
      .maybeSingle<ServerDraftRow>()
    if (error) {
      noteError(error, 'load')
      return null
    }
    return data && data.data && typeof data.data === 'object' ? data : null
  } catch (error) {
    noteError(error as MaybeError, 'load')
    return null
  }
}

// Returns the updated_at it saved, or null if it couldn't save.
export async function saveServerDraft(
  supabase: SupabaseClient,
  userId: string,
  draft: { data: Record<string, unknown>; step: number; title: string; area: string },
): Promise<string | null> {
  if (unavailable) return null
  try {
    const updatedAt = new Date().toISOString()
    const { error } = await supabase.from('listing_drafts').upsert(
      {
        user_id: userId,
        data: draft.data,
        step: draft.step,
        title: draft.title || null,
        area: draft.area || null,
        updated_at: updatedAt,
      },
      { onConflict: 'user_id' },
    )
    if (error) {
      noteError(error, 'save')
      return null
    }
    return updatedAt
  } catch (error) {
    noteError(error as MaybeError, 'save')
    return null
  }
}

// Remove the server draft and every draft photo (called after a successful submit).
export async function clearServerDraft(supabase: SupabaseClient, userId: string): Promise<void> {
  if (unavailable) return
  try {
    const { error } = await supabase.from('listing_drafts').delete().eq('user_id', userId)
    if (error) noteError(error, 'clear')
  } catch (error) {
    noteError(error as MaybeError, 'clear')
  }
  try {
    const folder = `drafts/${userId}`
    const { data: files } = await supabase.storage.from(PHOTO_BUCKET).list(folder, { limit: 100 })
    const paths = (files || []).map((file) => `${folder}/${file.name}`)
    if (paths.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(paths)
  } catch {
    // Leftover draft photos are harmless; nothing to tell the host.
  }
}

function photoExtension(file: File) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

export async function uploadDraftPhoto(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<string | null> {
  if (unavailable || photoUploadsOff) return null
  try {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const path = `drafts/${userId}/${id}.${photoExtension(file)}`
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
    if (error) {
      photoUploadsOff = true
      warnOnce('Could not upload a draft photo; it stays on this device.', error)
      return null
    }
    return path
  } catch (error) {
    photoUploadsOff = true
    warnOnce('Could not upload a draft photo; it stays on this device.', error)
    return null
  }
}

export async function removeDraftPhotos(supabase: SupabaseClient, paths: string[]): Promise<void> {
  if (unavailable || paths.length === 0) return
  try {
    await supabase.storage.from(PHOTO_BUCKET).remove(paths)
  } catch {
    // Orphaned draft photos are cleaned up on submit.
  }
}

export async function downloadDraftPhoto(
  supabase: SupabaseClient,
  path: string,
): Promise<File | null> {
  try {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(path)
    if (error || !data) return null
    const name = path.split('/').pop() || 'photo.jpg'
    return new File([data], name, { type: data.type || 'image/jpeg' })
  } catch {
    return null
  }
}

export function readDraftPhotoList(value: unknown): ServerDraftPhoto[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const { path, label } = item as { path?: unknown; label?: unknown }
    if (typeof path !== 'string' || !path) return []
    return [{ path, label: typeof label === 'string' ? label : '' }]
  })
}
