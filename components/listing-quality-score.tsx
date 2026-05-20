type ListingQualityScoreProps = {
  score: number
  label?: string
  suggestions?: string[]
}

export function ListingQualityScore({
  score,
  label = 'Quality score',
  suggestions = [],
}: ListingQualityScoreProps) {
  const tone = score >= 80 ? 'bg-green-500' : score >= 55 ? 'bg-amber-500' : 'bg-rose-500'

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{label}</p>
        <p className="text-xs font-bold text-stone-700">{score}/100</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${score}%` }} />
      </div>
      {suggestions.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs leading-5 text-stone-500">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>{suggestion}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
