type BooleanBadgeProps = {
  value: boolean
  yes: string
  no: string
  falseTone?: 'soft' | 'strong'
}

export function BooleanBadge({
  value,
  yes,
  no,
  falseTone = 'soft',
}: BooleanBadgeProps) {
  const falseClass = falseTone === 'strong' ? 'bg-stone-200 text-stone-700' : 'bg-stone-100 text-stone-700'

  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${
        value ? 'bg-green-100 text-green-700' : falseClass
      }`}
    >
      {value ? yes : no}
    </span>
  )
}
