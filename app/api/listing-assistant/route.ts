import { NextResponse } from 'next/server'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { kosherLevelLabel } from '@/lib/kosher'

type ListingAssistantRequest = {
  apartment_title?: string
  area?: string
  bedrooms?: string | number
  bathrooms?: string | number
  sleeps?: string | number
  sleeping_setup?: string
  amenities?: string[]
  kosher_kitchen_level?: string
  shabbat_elevator?: boolean
  shabbat_clock?: boolean
  sukkah_balcony?: boolean
  near_synagogue?: boolean
  walking_minutes_to_kotel?: string | number
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

  const apiKey = process.env.ANTHROPIC_API_KEY

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
      system: [
        "You edit listing copy for JLM Collective, a Jerusalem letting agency. The host has written a title and description; your job is to make the host's own words read clearly and warmly, not to write a new advert.",
        '',
        'Use only what is in the input: the host_notes, the title, the numbers, the amenities list and the shabbos_and_jewish_stay facts. You may fix grammar and spelling, reorder sentences, join them up, and mention listed amenities and facts in natural sentences.',
        '',
        "Do not add any description, quality or claim the host did not state. Hosts see every added word as a false statement about their home. Words like bright, spacious, newly renovated, modern, central, quiet, beautiful, cosy, family-friendly or perfect for, and any view, distance, condition or atmosphere, may appear only if the host wrote them or they are in the facts. Do not describe the neighbourhood beyond naming it.",
        '',
        'Keep the length close to what the host gave. If the host wrote two lines, return a short description; never pad it to reach a length. Plain, specific sentences, no hype.',
      ].join('\n'),
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
            shabbos_and_jewish_stay: [
              kosherLevelLabel(input.kosher_kitchen_level)
                ? `Kitchen: ${kosherLevelLabel(input.kosher_kitchen_level)}`
                : '',
              input.shabbat_elevator ? 'Building has a Shabbos elevator' : '',
              input.shabbat_clock ? 'Shabbos clock or timer for lights' : '',
              input.sukkah_balcony ? 'Balcony suitable for a sukkah' : '',
              input.near_synagogue ? 'Within 5 minutes walk of a shul' : '',
              input.walking_minutes_to_kotel
                ? `About ${input.walking_minutes_to_kotel} minutes walk to the Kotel`
                : '',
            ].filter(Boolean),
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
                description:
                  "The host's title, tidied up, under 70 characters. Only words supported by the input.",
              },
              description: {
                type: 'string',
                description:
                  "The host's description rewritten clearly, at most 120 words and no longer than the input supports. Only facts from the input.",
              },
              highlights: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'Up to three short highlights, each restating a fact from the input. Fewer if the input has fewer facts.',
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
