'use client'

import { useRef, useState, useTransition } from 'react'
import { useDragSort, moveItem } from '@/components/use-drag-sort'
import { requestPhotoLabel } from '@/lib/photo-labels'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ListingPhoto = {
  id: string
  photo_url: string
  storage_path: string | null
  is_cover: boolean
  sort_order: number
  label?: string | null
}

type ListingPhotoManagerProps = {
  listingId: string
  initialPhotos: ListingPhoto[]
}

const maxListingPhotoSizeMb = 10

function getImageExtension(file: File) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

function getUploadFailureMessage(fileName: string, message?: string) {
  const lowerMessage = message?.toLowerCase() || ''

  if (message) console.error(`Listing photo upload failed for ${fileName}:`, message)

  if (lowerMessage.includes('size') || lowerMessage.includes('too large')) {
    return `${fileName} is too large. Please use an image under ${maxListingPhotoSizeMb}MB.`
  }

  if (
    lowerMessage.includes('bucket') ||
    lowerMessage.includes('not found') ||
    lowerMessage.includes('row-level security') ||
    lowerMessage.includes('permission')
  ) {
    return `Could not add ${fileName} right now. Please contact JLM so we can fix this for you.`
  }

  return `Could not upload ${fileName}. Please try again.`
}

export function ListingPhotoManager({
  listingId,
  initialPhotos,
}: ListingPhotoManagerProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [photos, setPhotos] = useState(initialPhotos)
  const [message, setMessage] = useState('')
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [removingPhotoId, setRemovingPhotoId] = useState<string | null>(null)
  const [labellingIds, setLabellingIds] = useState<string[]>([])
  const supabase = createClient()

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return

    setMessage('')
    let nextSortOrder = photos.length
    const uploaded: ListingPhoto[] = []
    const fileList = Array.from(files)
    let processed = 0
    setUploadProgress({ done: 0, total: fileList.length })

    try {
      for (const file of fileList) {
        processed += 1
        setUploadProgress({ done: processed - 1, total: fileList.length })
        if (!file.type.startsWith('image/')) {
          setMessage('Please upload image files only.')
          continue
        }

        if (file.size > maxListingPhotoSizeMb * 1024 * 1024) {
          setMessage(`${file.name} is too large. Please use an image under ${maxListingPhotoSizeMb}MB.`)
          continue
        }

        const fileExt = getImageExtension(file)
        const fileName = `photo-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
        const storagePath = `listings/${listingId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('listing-photos')
          .upload(storagePath, file, {
            cacheControl: '3600',
            contentType: file.type || 'image/jpeg',
            upsert: false,
          })

        if (uploadError) {
          setMessage(getUploadFailureMessage(file.name, uploadError.message))
          continue
        }

        const { data: publicUrl } = supabase.storage
          .from('listing-photos')
          .getPublicUrl(storagePath)

        const { data: insertedPhoto, error: insertError } = await supabase
          .from('listing_photos')
          .insert({
            listing_id: listingId,
            photo_url: publicUrl.publicUrl,
            storage_path: storagePath,
            sort_order: nextSortOrder,
            is_cover: nextSortOrder === 0,
          })
          .select('id, photo_url, storage_path, is_cover, sort_order, label')
          .single()

        if (insertError) {
          setMessage(getUploadFailureMessage(file.name, insertError.message))
          continue
        }

        if (insertedPhoto) {
          setPhotos((current) => [...current, insertedPhoto as ListingPhoto])
          uploaded.push(insertedPhoto as ListingPhoto)
          nextSortOrder += 1
        }
      }
    } finally {
      setUploadProgress(null)
    }

    if (inputRef.current) inputRef.current.value = ''
    startTransition(() => router.refresh())
    void autoLabel(uploaded)
  }

  // Suggest a label for each photo that has none. Hosts can change it; a photo
  // they have labelled meanwhile is left alone.
  async function autoLabel(targets: ListingPhoto[]) {
    const unlabelled = targets.filter((photo) => !photo.label?.trim())
    for (const photo of unlabelled) {
      setLabellingIds((ids) => [...ids, photo.id])
      const label = await requestPhotoLabel({ url: photo.photo_url })
      setLabellingIds((ids) => ids.filter((id) => id !== photo.id))
      const current = photosRef.current.find((item) => item.id === photo.id)
      if (label && current && !current.label?.trim()) {
        await updatePhotoLabel(photo.id, label)
      }
    }
  }

  async function persistPhotoOrder(nextPhotos: ListingPhoto[]) {
    setMessage('')
    setPhotos(nextPhotos)

    // One atomic statement (sort_order + is_cover for every row) so the
    // cover-photo sync trigger sees the final ordering and never converges on the
    // previous cover — and it is a single round-trip instead of N.
    const { error } = await supabase.rpc('reorder_listing_photos', {
      p_listing_id: listingId,
      p_ordered_ids: nextPhotos.map((photo) => photo.id),
    })

    if (error) {
      console.error('Could not reorder listing photos', error)
      setMessage('Could not save the new photo order. Please try again.')
      return
    }

    startTransition(() => router.refresh())
  }

  // Reorder live while dragging; save the final order once, on drop.
  const photosRef = useRef(photos)
  photosRef.current = photos
  const photoSort = useDragSort({
    onMove: (fromIndex, toIndex) => setPhotos((current) => moveItem(current, fromIndex, toIndex)),
    onDrop: () =>
      void persistPhotoOrder(
        photosRef.current.map((item, itemIndex) => ({
          ...item,
          sort_order: itemIndex,
          is_cover: itemIndex === 0,
        })),
      ),
  })

  async function updatePhotoLabel(photoId: string, label: string) {
    setMessage('')
    setPhotos((current) =>
      current.map((photo) => (photo.id === photoId ? { ...photo, label } : photo)),
    )

    const { error } = await supabase
      .from('listing_photos')
      .update({ label: label.trim() || null })
      .eq('id', photoId)

    if (error) {
      console.error('Could not save listing photo label', error)
      setMessage('Could not save the photo label. Please try again.')
      return
    }

    startTransition(() => router.refresh())
  }

  async function removePhoto(photo: ListingPhoto) {
    if (!window.confirm('Remove this photo from your listing? This cannot be undone.')) return

    setMessage('')
    setRemovingPhotoId(photo.id)

    const { data: deletedRows, error } = await supabase
      .from('listing_photos')
      .delete()
      .eq('id', photo.id)
      .select('id')

    setRemovingPhotoId(null)

    // A delete blocked by row-level security returns no error and no rows, so
    // treat "nothing deleted" as a failure too.
    if (error || !deletedRows?.length) {
      console.error('Could not remove listing photo', error ?? 'No rows deleted')
      setMessage('Could not remove this photo. Please try again, or contact JLM if it keeps happening.')
      return
    }

    if (photo.storage_path) {
      await supabase.storage.from('listing-photos').remove([photo.storage_path])
    }

    const remainingPhotos = photos
      .filter((item) => item.id !== photo.id)
      .map((item, index) => ({
        ...item,
        sort_order: index,
        is_cover: index === 0,
      }))

    setPhotos(remainingPhotos)

    if (remainingPhotos.length > 0) {
      await persistPhotoOrder(remainingPhotos)
      return
    }

    startTransition(() => router.refresh())
  }

  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-[#F8F5F2] px-4 py-6 text-center transition hover:border-[#c76f55]">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={uploadProgress !== null}
          onChange={(event) => void handleUpload(event.target.files)}
        />
        <span className="text-sm font-bold text-stone-800">
          {uploadProgress
            ? `Uploading photo ${Math.min(uploadProgress.done + 1, uploadProgress.total)} of ${uploadProgress.total}... please keep this page open`
            : isPending
              ? 'Updating photos...'
              : 'Add photos'}
        </span>
        <span className="mt-1 text-xs text-stone-500">JPG, PNG or WebP up to {maxListingPhotoSizeMb}MB</span>
      </label>

      {photos.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-xs font-semibold text-stone-500">
            Drag photos to reorder them (on a phone, use the dotted handle). The first photo is your cover, shown on your listing card.
          </p>
          {photos.some((photo) => !photo.label?.trim()) && (
            <button
              type="button"
              onClick={() => void autoLabel(photos)}
              disabled={labellingIds.length > 0}
              className="mb-3 rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-800 transition hover:border-stone-500 disabled:opacity-60"
            >
              {labellingIds.length > 0 ? 'Labelling photos…' : 'Label photos without a label'}
            </button>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                {...photoSort.itemProps(index)}
                className={`cursor-grab overflow-hidden rounded-2xl bg-[#F8F5F2] transition-shadow active:cursor-grabbing ${
                  photoSort.draggingIndex === index ? 'opacity-60 shadow-lg ring-2 ring-[#c76f55]' : ''
                }`}
              >
              <div className="group relative">
                <img src={photo.photo_url} alt={photo.label || 'Listing photo'} draggable={false} className="aspect-[4/3] w-full object-cover" />
                <button
                  type="button"
                  {...photoSort.handleProps(index)}
                  className="absolute bottom-3 right-3 flex h-9 w-9 cursor-grab items-center justify-center rounded-full bg-white/90 text-stone-700 shadow-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <circle cx="5.5" cy="3.5" r="1.4" /><circle cx="10.5" cy="3.5" r="1.4" />
                    <circle cx="5.5" cy="8" r="1.4" /><circle cx="10.5" cy="8" r="1.4" />
                    <circle cx="5.5" cy="12.5" r="1.4" /><circle cx="10.5" cy="12.5" r="1.4" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => void removePhoto(photo)}
                  disabled={removingPhotoId !== null}
                  className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-800 shadow-sm transition hover:bg-stone-100 disabled:opacity-60"
                >
                  {removingPhotoId === photo.id ? 'Removing...' : 'Remove'}
                </button>
                {photo.is_cover ? (
                  <span className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-800 shadow-sm">
                    Cover
                  </span>
                ) : (
                  <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-stone-700 opacity-0 shadow-sm transition group-hover:opacity-100">
                    Drag to front to make cover
                  </span>
                )}
              </div>
              <div className="space-y-2 p-3">
                <input
                  value={photo.label || ''}
                  onChange={(event) => {
                    const label = event.target.value
                    setPhotos((current) => current.map((item) => (item.id === photo.id ? { ...item, label } : item)))
                  }}
                  onBlur={(event) => void updatePhotoLabel(photo.id, event.target.value)}
                  placeholder={labellingIds.includes(photo.id) ? 'Labelling…' : 'Photo label, e.g. Bedroom 1'}
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]"
                />
              </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {message && <p className="mt-3 text-sm text-red-700">{message}</p>}
    </div>
  )
}
