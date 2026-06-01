import { NextResponse } from 'next/server'

type ListingAssistantRequest = {
  apartment_title?: string
  area?: string
  bedrooms?: string | number
  bathrooms?: string | number
  sleeps?: string | number
  amenities?: string[]
  description?: string
}

type ResponseContent = {
  type?: string
  text?: string
}

type ResponseOutputItem = {
  content?: ResponseContent[]
}

type OpenAIResponseBody = {
  output_text?: string
  output?: ResponseOutputItem[]
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY

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

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_LISTING_MODEL || 'gpt-4o-mini',
      instructions:
        'You are an expert vacation rental editor for JLM Collective, a specialist Jerusalem letting agency. Write polished, trustworthy copy that feels warm, precise, and professional. Use only facts supplied by the host. Do not invent amenities, views, distances, religious facilities, accessibility, or claims that are not provided. Avoid hype, cliches, and salesy language.',
      input: JSON.stringify({
        existing_title: input.apartment_title || '',
        neighborhood: input.area || '',
        bedrooms: input.bedrooms || '',
        bathrooms: input.bathrooms || '',
        sleeps: input.sleeps || '',
        amenities: input.amenities || [],
        host_notes: input.description || '',
      }),
      text: {
        format: {
          type: 'json_schema',
          name: 'listing_copy',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: {
                type: 'string',
                description: 'A clear professional listing title under 70 characters.',
              },
              description: {
                type: 'string',
                description:
                  'A polished guest-facing description in 2 short paragraphs, under 120 words total.',
              },
              highlights: {
                type: 'array',
                description: 'Three concise factual highlights for the listing.',
                items: { type: 'string' },
                minItems: 3,
                maxItems: 3,
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
      typeof errorBody?.error?.message === 'string'
        ? errorBody.error.message
        : ''

    if (response.status === 401) {
      return NextResponse.json(
        { error: 'The OpenAI API key is not accepted. Please check the key in Vercel.' },
        { status: 502 },
      )
    }

    if (response.status === 429) {
      return NextResponse.json(
        {
          error:
            upstreamMessage.toLowerCase().includes('quota') ||
            upstreamMessage.toLowerCase().includes('billing')
              ? 'The OpenAI account has no available API credit or billing enabled.'
              : 'AI listing help is busy right now. Please try again in a moment.',
        },
        { status: 503 },
      )
    }

    return NextResponse.json(
      {
        error:
          upstreamMessage ||
          'Unable to generate listing copy right now.',
      },
      { status: 500 },
    )
  }

  const data = (await response.json()) as OpenAIResponseBody
  const outputText =
    data.output_text ||
    data.output
      ?.flatMap((item) => item.content || [])
      ?.find((content) => content.type === 'output_text')
      ?.text

  if (!outputText) {
    return NextResponse.json(
      { error: 'The AI response was empty.' },
      { status: 500 },
    )
  }

  try {
    return NextResponse.json(JSON.parse(outputText))
  } catch {
    return NextResponse.json(
      { error: 'The AI response could not be read. Please try again.' },
      { status: 500 },
    )
  }
}
