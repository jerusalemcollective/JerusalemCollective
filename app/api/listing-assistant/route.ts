import { NextResponse } from 'next/server'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

type ListingAssistantRequest = {
  apartment_title?: string
  area?: string
  bedrooms?: string | number
  bathrooms?: string | number
  sleeps?: string | number
  sleeping_setup?: string
  amenities?: string[]
  description?: string
}

type AnthropicContentBlock = {
  type?: string
  text?: string
}

type AnthropicResponseBody = {
  content?: AnthropicContentBlock[]
}

type ListingCopy = {
  title?: string
  description?: string
  highlights?: string[]
}

export async function POST(request: Request) {
  if (!rateLimit(`listing-assistant:${getClientIp(request)}`, 15, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 })
  }

  // The deployed env var was added as ANTHROPIK_API_KEY (misspelled); accept
  // both so the AI assistant works whether or not it gets renamed in Vercel.
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIK_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI listing help is not configured yet.' },
      { status: 503 },
    )
  }

  let input: ListingAssistantRequest

  try {
    input = (await request.json()) as ListingAssistantRequest
  } catch {
    return NextResponse.json(
      { error: 'The listing details could not be read. Please try again.' },
      { status: 400 },
    )
  }

  const model = process.env.ANTHROPIC_LISTING_MODEL || 'claude-opus-4-8'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system:
        'You are an expert vacation rental editor for JLM Collective, a specialist Jerusalem letting agency. Write polished, trustworthy copy that feels warm, precise, and professional. Use only facts supplied by the host. Do not invent amenities, views, distances, religious facilities, accessibility, or claims that are not provided. Avoid hype, cliches, and salesy language.',
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            existing_title: input.apartment_title || '',
            neighborhood: input.area || '',
            bedrooms: input.bedrooms || '',
            bathrooms: input.bathrooms || '',
            sleeps: input.sleeps || '',
            sleeping_setup: input.sleeping_setup || '',
            amenities: input.amenities || [],
            host_notes: input.description || '',
          }),
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: {
                type: 'string',
                description: 'A clear, professional listing title under 70 characters.',
              },
              description: {
                type: 'string',
                description:
                  'A polished guest-facing description in two short paragraphs, under 120 words total.',
              },
              highlights: {
                type: 'array',
                items: { type: 'string' },
                description: 'Exactly three concise, factual highlights for the listing.',
              },
            },
            required: ['title', 'description', 'highlights'],
          },
        },
      },
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

    if (response.status === 429 || response.status === 529) {
      return NextResponse.json(
        { error: 'AI listing help is busy right now. Please try again in a moment.' },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: upstreamMessage || 'Unable to generate listing copy right now.' },
      { status: 500 },
    )
  }

  const data = (await response.json()) as AnthropicResponseBody
  const outputText = (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text || '')
    .join('')
    .trim()

  if (!outputText) {
    return NextResponse.json(
      { error: 'The AI response was empty.' },
      { status: 500 },
    )
  }

  let parsed: ListingCopy

  try {
    parsed = JSON.parse(outputText) as ListingCopy
  } catch {
    return NextResponse.json(
      { error: 'The AI response could not be read. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    title: parsed.title || '',
    description: parsed.description || '',
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights.slice(0, 3) : [],
  })
}
