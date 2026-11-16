import { STAY_TERMS_FIELDS, formatStayTime, toTimeInputValue, type StayTerms } from '@/lib/stay-terms'

const selectClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition focus:border-[#c76f55]'

// Half-hour slots for the check-in / check-out dropdowns.
const TIME_SLOTS = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 2)
  return `${String(hours).padStart(2, '0')}:${index % 2 ? '30' : '00'}`
})

// Controlled values (strings, '' = not set) for client forms that keep their own
// state, such as the become-a-host wizard.
export type StayTermsDraft = {
  check_in_time: string
  check_out_time: string
}

type StayTermsFieldsProps = {
  terms?: Partial<StayTerms> | null
  // Controlled mode: pass both. No hidden marker is rendered; the caller saves.
  value?: StayTermsDraft
  onChange?: (field: keyof StayTermsDraft, value: string) => void
  // False when the columns don't exist yet (migration 118/123 not run): renders
  // `unavailableNote` instead of the fields, and no marker, so saving leaves the
  // columns alone.
  available?: boolean
  unavailableNote?: React.ReactNode
  className?: string
}

// Check-in / check-out times. No <form> of its own, so it rides inside the
// listing editors and saves with them. The hidden marker tells the server action
// the stay-terms fields were shown (see readStayTermsFromForm); the cancellation
// fields that go with it are in DepositCancellationFields.
export function StayTermsFields({
  terms,
  value,
  onChange,
  available = true,
  unavailableNote,
  className = 'mt-6 border-t border-stone-100 pt-6',
}: StayTermsFieldsProps) {
  if (!available) {
    return unavailableNote ? (
      <div className={className}>
        <p className="rounded-2xl bg-[#F8F5F2] p-4 text-sm leading-6 text-stone-600">{unavailableNote}</p>
      </div>
    ) : null
  }

  const controlled = Boolean(value && onChange)
  const bind = (field: keyof StayTermsDraft, initial: string) =>
    controlled
      ? {
          value: value?.[field] ?? '',
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange?.(field, event.target.value),
        }
      : { defaultValue: initial }

  const options = (current: string) => {
    const slots = current && !TIME_SLOTS.includes(current) ? [...TIME_SLOTS, current].sort() : TIME_SLOTS
    return [
      <option key="none" value="">
        No fixed time
      </option>,
      ...slots.map((slot) => (
        <option key={slot} value={slot}>
          {formatStayTime(slot)}
        </option>
      )),
    ]
  }
  const checkIn = controlled ? value?.check_in_time || '' : toTimeInputValue(terms?.check_in_time)
  const checkOut = controlled ? value?.check_out_time || '' : toTimeInputValue(terms?.check_out_time)

  return (
    <div className={className}>
      {!controlled && <input type="hidden" name={STAY_TERMS_FIELDS.marker} value="1" />}

      <h3 className="text-sm font-bold text-stone-950">Check-in and check-out</h3>
      <p className="mt-1 text-sm leading-6 text-stone-600">Shown to guests on the listing page.</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-stone-800">Check-in from</span>
          <select name={STAY_TERMS_FIELDS.checkIn} {...bind('check_in_time', checkIn)} className={selectClass}>
            {options(checkIn)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-stone-800">Check-out by</span>
          <select name={STAY_TERMS_FIELDS.checkOut} {...bind('check_out_time', checkOut)} className={selectClass}>
            {options(checkOut)}
          </select>
        </label>
      </div>
    </div>
  )
}
