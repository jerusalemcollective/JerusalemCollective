// Persist a listing draft's photo files across reloads. localStorage can only
// hold text, so the become-a-host draft loses its photos on reload; IndexedDB
// can store the actual File/Blob objects, so we keep them here keyed by the same
// draft key. Best-effort throughout: any failure resolves to a no-op / empty so
// the form never breaks because of the store.

const DB_NAME = 'jlm-listing-draft'
const DB_VERSION = 1
const STORE = 'photos'

export type StoredDraftPhoto = { file: File; label: string }

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function saveDraftPhotos(key: string, photos: StoredDraftPhoto[]): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(photos, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
  db.close()
}

export async function loadDraftPhotos(key: string): Promise<StoredDraftPhoto[]> {
  const db = await openDb()
  if (!db) return []
  const result = await new Promise<StoredDraftPhoto[]>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(key)
      request.onsuccess = () => {
        const value = request.result
        resolve(Array.isArray(value) ? (value as StoredDraftPhoto[]) : [])
      }
      request.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
  db.close()
  return result
}

export async function clearDraftPhotos(key: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
  db.close()
}
