'use client'

import { useRef, useState, useTransition, type PointerEvent } from 'react'
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

  if (lowerMessage.includes('bucket') || lowerMessage.includes('not found')) {
    return 'Photo upload storage is not set up yet. Please run the listing photos storage SQL in Supabase.'
  }

  if (lowerMessage.includes('row-level security') || lowerMessage.includes('permission')) {
    return 'Adding photos to a live listing is blocked in Supabase. Please run migration 095 (host listing photo insert) in Supabase.'
  }

  if (lowerMessage.includes('size') || lowerMessage.includes('too large')) {
    return `${fileName} is too large. Please use an image under ${maxListingPhotoSizeMb}MB.`
  }

  return message
    ? `Failed to upload ${fileName}: ${message}`
    : `Failed to upload ${fileName}. Please try again.`
}

export function ListingPhotoManager({
  listingId,
  initialPhotos,
}: ListingPhotoManagerProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [photos, setPhotos] = useState(initialPhotos)
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()
  const [draggingPhotoIndex, setDraggingPhotoIndex] = useState<number | null>(null)
  const photoSwipeStartRef = useRef<{ index: number; x: number; pointerId: number } | null>(null)
  const supabase = createClient()

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return

    setMessage('')
    let nextSortOrder = photos.length

    for (const file of Array.from(files)) {
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
        nextSortOrder += 1
      }
    }

    if (inputRef.current) inputRef.current.value = ''
    startTransition(() => router.refresh())
  }

  async function persistPhotoOrder(nextPhotos: ListingPhoto[]) {
    setMessage('')
    setPhotos(nextPhotos)

    const updates = nextPhotos.map((photo, index) =>
      supabase
        .from('listing_photos')
        .update({
          sort_order: index,
          is_cover: index === 0,
        })
        .eq('id', photo.id),
    )

    const results = await Promise.all(updates)
    const firstError = results.find((result) => result.error)?.error

    if (firstError) {
      setMessage(firstError.message)
      return
    }

    startTransition(() => router.refresh())
  }

  async function reorderPhotos(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return

    const nextPhotos = [...photos]
    const [photo] = nextPhotos.splice(fromIndex, 1)
    nextPhotos.splice(toIndex, 0, photo)
    await persistPhotoOrder(nextPhotos.map((item, itemIndex) => ({
      ...item,
      sort_order: itemIndex,
      is_cover: itemIndex === 0,
    })))
  }

  async function dropPhoto(targetIndex: number) {
    if (draggingPhotoIndex === null) return
    await reorderPhotos(draggingPhotoIndex, targetIndex)
    setDraggingPhotoIndex(null)
  }

  function startPhotoSwipe(index: number, event: PointerEvent<HTMLDivElement>) {
    photoSwipeStartRef.current = {
      index,
      x: event.clientX,
      pointerId: event.pointerId,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  async function finishPhotoSwipe(index: number, event: PointerEvent<HTMLDivElement>) {
    const start = photoSwipeStartRef.current
    photoSwipeStartRef.current = null

    if (!start || start.index !== index || start.pointerId !== event.pointerId) return

    const deltaX = event.clientX - start.x

    if (Math.abs(deltaX) < 45) return

    const direction = deltaX < 0 ? 1 : -1
    const targetIndex = index + direction

    if (targetIndex < 0 || targetIndex >= photos.length) return

    await reorderPhotos(index, targetIndex)
  }

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
      setMessage(error.message)
      return
    }

    startTransition(() => router.refresh())
  }

  async function removePhoto(photo: ListingPhoto) {
    setMessage('')

    const { error } = await supabase
      .from('listing_photos')
      .delete()
      .eq('id', photo.id)

    if (error) {
      setMessage(error.message)
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
          onChange={(event) => void handleUpload(event.target.files)}
        />
        <span className="text-sm font-bold text-stone-800">
          {isPending ? 'Updating photos...' : 'Add photos'}
        </span>
        <span className="mt-1 text-xs text-stone-500">JPG, PNG or WebP up to {maxListingPhotoSizeMb}MB</span>
      </label>

      {photos.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-xs font-semibold text-stone-500">
            Drag a photo to the front to make it your cover — it&rsquo;s the photo shown on your listing card.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                draggable
                onDragStart={() => setDraggingPhotoIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void dropPhoto(index)}
                onDragEnd={() => setDraggingPhotoIndex(null)}
                onPointerDown={(event) => startPhotoSwipe(index, event)}
                onPointerUp={(event) => void finishPhotoSwipe(index, event)}
                onPointerCancel={() => {
                  photoSwipeStartRef.current = null
                }}
                className={`touch-pan-y cursor-grab overflow-hidden rounded-2xl bg-[#F8F5F2] active:cursor-grabbing ${draggingPhotoIndex === index ? 'opacity-60' : ''}`}
              >
              <div className="group relative">
                <img src={photo.photo_url} alt={photo.label || 'Listing photo'} className="aspect-[4/3] w-full object-cover" />
                <button
                  type="button"
                  onClick={() => void removePhoto(photo)}
                  className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-800 shadow-sm transition hover:bg-stone-100"
                >
                  Remove
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
                  defaultValue={photo.label || ''}
                  onBlur={(event) => void updatePhotoLabel(photo.id, event.target.value)}
                  placeholder="Photo label, e.g. Bedroom 1"
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
