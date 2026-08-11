import { NextResponse } from 'next/server'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

type TranslateRequest = {
  text?: string
  kind?: 'title' | 'description' | 'generic'
}

type AnthropicContentBlock = {
  type?: string
  text?: string
}

type AnthropicResponseBody = {
  content?: AnthropicContentBlock[]
  stop_reason?: string
}

// Bound per-request cost/abuse. Listing fields are short; 6000 chars is generous.
const MAX_INPUT_CHARS = 6000

const KIND_GUIDANCE: Record<NonNullable<TranslateRequest['kind']>, string> = {
  title:
    'This is a listing title. Keep it concise (under 70 characters) and natural as a title, not a full sentence.',
  description:
    'This is a guest-facing listing description. Produce warm, polished, professional English in one or two short paragraphs.',
  generic:
    'Translate and lightly polish into clear, professional English.',
}

export async function POST(request: Request) {
  if (!rateLimit(`translate-listing:${getClientIp(request)}`, 15, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI translation is not configured yet.' },
      { status: 503 },
    )
  }

  let input: TranslateRequest

  try {
    input = (await request.json()) as TranslateRequest
  } catch {
    return NextResponse.json(
      { error: 'The text could not be read. Please try again.' },
      { status: 400 },
    )
  }

  const text = typeof input.text === 'string' ? input.text.trim() : ''
  const kind: NonNullable<TranslateRequest['kind']> =
    input.kind && input.kind in KIND_GUIDANCE ? input.kind : 'generic'

  if (!text) {
    return NextResponse.json(
      { error: 'Please enter some text to translate.' },
      { status: 400 },
    )
  }

  if (text.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: `Please shorten the text to under ${MAX_INPUT_CHARS} characters.` },
      { status: 400 },
    )
  }

  const model = process.env.ANTHROPIC_TRANSLATE_MODEL || 'claude-opus-4-8'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system:
        'You are a professional translator and copy editor for JLM Collective, a specialist Jerusalem vacation-rental agency. The host has written listing text in Hebrew, or in a mix of Hebrew and English. Translate it into natural, polished, guest-facing English and lightly refine the wording so it reads warm, precise, and professional. Stay strictly faithful to the meaning: never invent amenities, views, distances, religious facilities, accessibility, or any fact the host did not state. Preserve any English already present. If the text is already entirely in clear English, return it essentially unchanged. Respond with ONLY the final English text — no preamble, no commentary, no quotation marks, no notes.',
      messages: [
        {
          role: 'user',
          content: `${KIND_GUIDANCE[kind]}\n\nHost text:\n${text}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    const upstreamMessage =
      typeof errorBody?.error?.message === 'string' ? errorBody.error.message : ''

    if (response.status === 401) {
      return NextResponse.json(
        { error: 'The Anthropic API key is not accepted. Please check the key in Vercel.' },
        { status: 502 },
      )
    }

    if (response.status === 429) {
      return NextResponse.json(
        { error: 'AI translation is busy right now. Please try again in a moment.' },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: upstreamMessage || 'Unable to translate right now.' },
      { status: 500 },
    )
  }

  const data = (await response.json()) as AnthropicResponseBody

  const translated = (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text || '')
    .join('')
    .trim()

  if (!translated) {
    return NextResponse.json(
      { error: 'The AI response was empty. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ translated })
}
