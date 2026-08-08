type MinNightsFieldProps = {
  minNights: number
}

const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]'

// A single minimum-night input, no <form> of its own, so it rides inside the
// listing-edit form and saves with the shared "Save changes" button. Default 1
// means no minimum, matching the previous behaviour.
export function MinNightsField({ minNights }: MinNightsFieldProps) {
  return (
    <label className="mt-6 block border-t border-stone-100 pt-6">
      <span className="text-sm font-bold text-stone-950">Minimum nights</span>
      <input
        name="minNights"
        type="number"
        min="1"
        max="365"
        defaultValue={minNights}
        className={inputClass}
      />
    </label>
  )
}
