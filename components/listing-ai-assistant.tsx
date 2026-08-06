'use client'

import { useState } from 'react'

type AiSuggestion = {
  title?: string
  description?: string
  highlights?: string[]
  error?: string
}

type ListingAiAssistantProps = {
  formId: string
  titleField: string
  areaField: string
  bedroomsField: string
  bathroomsField: string
  guestsField: string
  amenitiesField: string
  descriptionField: string
}

export function ListingAiAssistant({
  formId,
  titleField,
  areaField,
  bedroomsField,
  bathroomsField,
  guestsField,
  amenitiesField,
  descriptionField,
}: ListingAiAssistantProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null)
  const [translateLoading, setTranslateLoading] = useState(false)
  const [translateError, setTranslateError] = useState('')
  const [translateResult, setTranslateResult] = useState<{
    title: string
    description: string
  } | null>(null)

  async function generateSuggestion() {
    const form = document.getElementById(formId)

    if (!(form instanceof HTMLFormElement)) {
      setError('The listing form could not be found. Please refresh and try again.')
      return
    }

    const formData = new FormData(form)
    setLoading(true)
    setError('')
    setSuggestion(null)

    try {
      const response = await fetch('/api/listing-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apartment_title: String(formData.get(titleField) || ''),
          area: String(formData.get(areaField) || ''),
          bedrooms: String(formData.get(bedroomsField) || ''),
          bathrooms: String(formData.get(bathroomsField) || ''),
          sleeps: String(formData.get(guestsField) || ''),
          amenities: formData.getAll(amenitiesField).map(String),
          description: String(formData.get(descriptionField) || ''),
        }),
      })

      const data = (await response.json()) as AiSuggestion

      if (!response.ok) {
        throw new Error(data.error || 'Unable to improve this listing right now.')
      }

      setSuggestion(data)
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : 'Unable to improve this listing right now.',
      )
    } finally {
      setLoading(false)
    }
  }

  function applySuggestion() {
    if (!suggestion) return

    setFieldValue(formId, titleField, suggestion.title)
    setFieldValue(formId, descriptionField, suggestion.description)
  }

  async function translateField(text: string, kind: 'title' | 'description') {
    const trimmed = text.trim()
    if (!trimmed) return ''

    const response = await fetch('/api/translate-listing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: trimmed, kind }),
    })

    const data = (await response.json()) as { translated?: string; error?: string }

    if (!response.ok) {
      throw new Error(data.error || 'Unable to translate right now.')
    }

    return data.translated || ''
  }

  async function translateToEnglish() {
    const form = document.getElementById(formId)

    if (!(form instanceof HTMLFormElement)) {
      setTranslateError('The listing form could not be found. Please refresh and try again.')
      return
    }

    const formData = new FormData(form)
    const title = String(formData.get(titleField) || '').trim()
    const description = String(formData.get(descriptionField) || '').trim()

    if (!title && !description) {
      setTranslateError('Write the title or description first, then translate it to English.')
      return
    }

    setTranslateLoading(true)
    setTranslateError('')
    setTranslateResult(null)

    try {
      const [translatedTitle, translatedDescription] = await Promise.all([
        translateField(title, 'title'),
        translateField(description, 'description'),
      ])

      setTranslateResult({
        title: translatedTitle || title,
        description: translatedDescription || description,
      })
    } catch (translateErr) {
      setTranslateError(
        translateErr instanceof Error
          ? translateErr.message
          : 'Unable to translate right now.',
      )
    } finally {
      setTranslateLoading(false)
    }
  }

  function applyTranslation() {
    if (!translateResult) return

    setFieldValue(formId, titleField, translateResult.title)
    setFieldValue(formId, descriptionField, translateResult.description)
    setTranslateResult(null)
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-[#fcfaf8] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold text-stone-950">AI listing assistant</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void generateSuggestion()}
            disabled={loading}
            className="rounded-full bg-[#252525] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Improving...' : 'Improve with AI'}
          </button>
          <button
            type="button"
            onClick={() => void translateToEnglish()}
            disabled={translateLoading}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-800 transition hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {translateLoading ? 'Translating...' : 'Translate Hebrew → English'}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {suggestion && (
        <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
            Suggested copy
          </p>
          <h3 className="mt-3 text-lg font-bold text-stone-950">{suggestion.title}</h3>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-stone-700">
            {suggestion.description}
          </p>
          {suggestion.highlights && suggestion.highlights.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestion.highlights.map((highlight) => (
                <span
                  key={highlight}
                  className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-700"
                >
                  {highlight}
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={applySuggestion}
            className="mt-5 rounded-full border border-stone-300 px-4 py-2 text-sm font-bold text-stone-800 transition hover:border-stone-500"
          >
            Use this wording
          </button>
        </div>
      )}

      {translateError && <p className="mt-4 text-sm text-red-600">{translateError}</p>}

      {translateResult && (
        <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
            English translation
          </p>
          <h3 className="mt-3 text-lg font-bold text-stone-950" dir="auto">
            {translateResult.title}
          </h3>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-stone-700" dir="auto">
            {translateResult.description}
          </p>
          <button
            type="button"
            onClick={applyTranslation}
            className="mt-5 rounded-full border border-stone-300 px-4 py-2 text-sm font-bold text-stone-800 transition hover:border-stone-500"
          >
            Use this English
          </button>
        </div>
      )}
    </section>
  )
}

function setFieldValue(formId: string, fieldName: string, value?: string) {
  if (!value) return

  const form = document.getElementById(formId)
  if (!(form instanceof HTMLFormElement)) return

  const field = form.elements.namedItem(fieldName)

  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    field.value = value
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))
  }
}
