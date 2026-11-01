// Room labels the photo labeller may suggest. Hosts can type anything else.
export const PHOTO_LABELS = [
  'Living room',
  'Dining area',
  'Kitchen',
  'Bedroom',
  'Bathroom',
  'Balcony',
  'Sukkah balcony',
  'Garden',
  'Entrance',
  'Hallway',
  'Building',
  'Street',
  'View',
] as const

const MAX_SIDE = 768

// Shrink a local image file to a small JPEG (base64, no data: prefix) before
// sending it to be labelled: faster, cheaper, and under the request size limit.
export async function shrinkImageForLabel(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1] || null
  } catch {
    return null
  }
}

// Ask the server to label one photo. Returns null on any failure, so callers
// simply leave the label empty for the host to fill in.
export async function requestPhotoLabel(image: { data: string } | { url: string }): Promise<string | null> {
  try {
    const response = await fetch('/api/photo-label', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(image),
    })
    if (!response.ok) return null
    const result = (await response.json()) as { label?: string | null }
    return result.label || null
  } catch {
    return null
  }
}
