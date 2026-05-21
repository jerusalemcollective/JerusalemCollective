'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ApplicationPhoto = {
  id: string
  photo_url: string
  storage_path: string | null
  is_cover: boolean
  sort_order: number
}

type ApplicationPhotoManagerProps = {
  applicationId: string
  initialPhotos: ApplicationPhoto[]
}

export function ApplicationPhotoManager({
  applicationId,
  initialPhotos,
}: ApplicationPhotoManagerProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [photos, setPhotos] = useState(initialPhotos)
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()
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

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `photo-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
      const storagePath = `listings/${applicationId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('listing-photos')
        .upload(storagePath, file)

      if (uploadError) {
        setMessage(uploadError.message)
        continue
      }

      const { data: publicUrl } = supabase.storage
        .from('listing-photos')
        .getPublicUrl(storagePath)

      const { data: insertedPhoto, error: insertError } = await supabase
        .from('listing_photos')
        .insert({
          application_id: applicationId,
          photo_url: publicUrl.publicUrl,
          storage_path: storagePath,
          sort_order: nextSortOrder,
          is_cover: nextSortOrder === 0,
        })
        .select('id, photo_url, storage_path, is_cover, sort_order')
        .single()

      if (insertError) {
        setMessage(insertError.message)
        continue
      }

      if (insertedPhoto) {
        setPhotos((current) => [...current, insertedPhoto as ApplicationPhoto])
        nextSortOrder += 1
      }
    }

    if (inputRef.current) inputRef.current.value = ''
    startTransition(() => router.refresh())
  }

  async function removePhoto(photo: ApplicationPhoto) {
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

    setPhotos((current) => current.filter((item) => item.id !== photo.id))
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
        <span className="mt-1 text-xs text-stone-500">JPG, PNG or WebP</span>
      </label>

      {photos.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative overflow-hidden rounded-2xl">
              <img src={photo.photo_url} alt="" className="aspect-[4/3] w-full object-cover" />
              <button
                type="button"
                onClick={() => void removePhoto(photo)}
                className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-800 shadow-sm transition hover:bg-stone-100"
              >
                Remove
              </button>
              {photo.is_cover && (
                <span className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-800 shadow-sm">
                  Cover
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {message && <p className="mt-3 text-sm text-red-700">{message}</p>}
    </div>
  )
}
