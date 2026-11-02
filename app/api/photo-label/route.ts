import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { PHOTO_LABELS } from '@/lib/photo-labels'

// Suggests a short room label ("Kitchen", "Bedroom", ...) for one listing photo.
// The host can always change it; on any failure the label is left empty.

const MAX_BASE64_LENGTH = 1_500_000

export async function POST(request: Request) {
  if (!rateLimit(`photo-label:${getClientIp(request)}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Photo labelling is not configured.' }, { status: 503 })
  }

  let body: { data?: unknown; url?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  let source: Anthropic.Beta.Messages.BetaImageBlockParam['source']
  if (typeof body.data === 'string' && body.data.length > 0 && body.data.length <= MAX_BASE64_LENGTH) {
    source = { type: 'base64', media_type: 'image/jpeg', data: body.data }
  } else if (typeof body.url === 'string' && isOwnStorageUrl(body.url)) {
    source = { type: 'url', url: body.url }
  } else {
    return NextResponse.json({ error: 'Send a small JPEG or a listing photo URL.' }, { status: 400 })
  }

  try {
    const anthropic = new Anthropic()
    const response = await anthropic.beta.messages.create({
      model: process.env.ANTHROPIC_PHOTO_MODEL || 'claude-opus-5-5',
      max_tokens: 1024,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              label: { type: 'string', enum: [...PHOTO_LABELS, 'Other'] },
            },
            required: ['label'],
          },
        },
      },
      system:
        'You label photos of short-term rental apartments in Jerusalem. Pick the one label that best names the room or space shown. A balcony with a sukkah or sukkah-style roofing is "Sukkah balcony". Use "Other" if none fit.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source },
            { type: 'text', text: 'Which label fits this photo?' },
          ],
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ label: null })
    }

    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
    const parsed = JSON.parse(text) as { label?: string }
    const label = PHOTO_LABELS.find((option) => option === parsed.label) ?? null
    return NextResponse.json({ label })
  } catch (error) {
    console.error('Photo labelling failed', error)
    return NextResponse.json({ label: null })
  }
}

// Only label photos in the listing-photos storage bucket, so this route can't
// be used to label arbitrary images. Matching on the path (not the host) keeps
// it working if Supabase storage is served from a custom domain.
function isOwnStorageUrl(url: string) {
  try {
    const target = new URL(url)
    return (
      target.protocol === 'https:' &&
      target.pathname.startsWith('/storage/v1/object/public/listing-photos/')
    )
  } catch {
    return false
  }
}
