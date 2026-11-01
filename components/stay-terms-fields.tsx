import {
  CANCELLATION_AGREED_HOST_EXPLANATION,
  CANCELLATION_AGREED_LABEL,
  CANCELLATION_POLICIES,
  CANCELLATION_POLICY_PRESETS,
  STAY_TERMS_FIELDS,
  toTimeInputValue,
  type StayTerms,
} from '@/lib/stay-terms'

const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]'

type StayTermsFieldsProps = {
  terms?: Partial<StayTerms> | null
  // False when the columns don't exist yet (migration 118 not run): renders
  // `unavailableNote` instead of the fields, and no marker, so saving leaves the
  // columns alone.
  available?: boolean
  unavailableNote?: React.ReactNode
  // "you" wording for hosts, "the host" for admins.
  audience?: 'host' | 'admin'
  className?: string
}

// Check-in / check-out times and cancellation policy. No <form> of its own, so it
// rides inside the listing editors and saves with them. The hidden marker tells
// the server action the fields were shown (see readStayTermsFromForm).
export function StayTermsFields({
  terms,
  available = true,
  unavailableNote,
  audience = 'host',
  className = 'mt-6 border-t border-stone-100 pt-6',
}: StayTermsFieldsProps) {
  if (!available) {
    return unavailableNote ? (
      <div className={className}>
        <p className="rounded-2xl bg-[#F8F5F2] p-4 text-sm leading-6 text-stone-600">{unavailableNote}</p>
      </div>
    ) : null
  }

  const currentPolicy = terms?.cancellation_policy || ''
  const agreedLabel = audience === 'admin' ? 'Agreed with the host per booking' : CANCELLATION_AGREED_LABEL
  const agreedExplanation =
    audience === 'admin'
      ? 'No fixed policy: the host and guest agree cancellation terms before the guest pays.'
      : CANCELLATION_AGREED_HOST_EXPLANATION

  const choices = [
    { value: '', label: agreedLabel, explanation: agreedExplanation },
    ...CANCELLATION_POLICIES.map((key) => ({
      value: key,
      label: CANCELLATION_POLICY_PRESETS[key].label,
      explanation: CANCELLATION_POLICY_PRESETS[key].hostExplanation,
    })),
  ]

  return (
    <div className={className}>
      <input type="hidden" name={STAY_TERMS_FIELDS.marker} value="1" />

      <h3 className="text-sm font-bold text-stone-950">Check-in and check-out</h3>
      <p className="mt-1 text-sm leading-6 text-stone-600">
        Shown to guests on the listing page. Leave blank if there is no fixed time.
      </p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-stone-800">Check-in from</span>
          <input
            type="time"
            name={STAY_TERMS_FIELDS.checkIn}
            defaultValue={toTimeInputValue(terms?.check_in_time)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-stone-800">Check-out by</span>
          <input
            type="time"
            name={STAY_TERMS_FIELDS.checkOut}
            defaultValue={toTimeInputValue(terms?.check_out_time)}
            className={inputClass}
          />
        </label>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-bold text-stone-950">Cancellation policy</legend>
        <div className="mt-3 grid gap-3">
          {choices.map((choice) => (
            <label
              key={choice.value || 'agreed'}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-200 p-4 transition has-[:checked]:border-[#c76f55] has-[:checked]:bg-[#FDF6F3]"
            >
              <input
                type="radio"
                name={STAY_TERMS_FIELDS.policy}
                value={choice.value}
                defaultChecked={currentPolicy === choice.value}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-bold text-stone-950">{choice.label}</span>
                <span className="mt-0.5 block text-sm leading-6 text-stone-600">{choice.explanation}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-5 block">
        <span className="text-sm font-semibold text-stone-800">Cancellation notes (optional)</span>
        <textarea
          name={STAY_TERMS_FIELDS.notes}
          rows={3}
          maxLength={2000}
          defaultValue={terms?.cancellation_policy_notes || ''}
          placeholder="e.g. Date changes are free if requested at least 14 days before arrival."
          dir="auto"
          className={`${inputClass} resize-y`}
        />
      </label>
    </div>
  )
}
