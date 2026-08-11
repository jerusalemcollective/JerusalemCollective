'use client'

import { formatMoney } from '@/lib/currencies'

// A two-thumb range slider: drag either end. Values are whole numbers in the
// given currency; the caller decides whether they mean per-night or a total.
export function PriceRangeSlider({
  max,
  valueMin,
  valueMax,
  onChange,
  currency,
}: {
  max: number
  valueMin: number
  valueMax: number
  onChange: (min: number, max: number) => void
  currency: string
}) {
  const step = Math.max(1, Math.round(max / 100))
  const percent = (value: number) => (max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0)

  return (
    <div>
      <div className="flex items-center justify-between text-sm font-semibold text-stone-900">
        <span>{formatMoney(valueMin, currency)}</span>
        <span>
          {formatMoney(valueMax, currency)}
          {valueMax >= max ? '+' : ''}
        </span>
      </div>

      <div className="relative mt-3 h-6">
        <div className="pointer-events-none absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-stone-200" />
        <div
          className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#c76f55]"
          style={{ left: `${percent(valueMin)}%`, right: `${100 - percent(valueMax)}%` }}
        />
        <input
          type="range"
          min={0}
          max={max}
          step={step}
          value={valueMin}
          onChange={(event) => onChange(Math.min(Number(event.target.value), valueMax - step), valueMax)}
          aria-label="Minimum price"
          className="dual-range-input"
        />
        <input
          type="range"
          min={0}
          max={max}
          step={step}
          value={valueMax}
          onChange={(event) => onChange(valueMin, Math.max(Number(event.target.value), valueMin + step))}
          aria-label="Maximum price"
          className="dual-range-input"
        />
      </div>

      <style>{`
        .dual-range-input {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 24px;
          margin: 0;
          background: transparent;
          -webkit-appearance: none;
          appearance: none;
          pointer-events: none;
        }
        .dual-range-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          pointer-events: auto;
          height: 18px;
          width: 18px;
          border-radius: 9999px;
          background: #ffffff;
          border: 2px solid #c76f55;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
        }
        .dual-range-input::-moz-range-thumb {
          pointer-events: auto;
          height: 18px;
          width: 18px;
          border-radius: 9999px;
          background: #ffffff;
          border: 2px solid #c76f55;
          cursor: pointer;
        }
        .dual-range-input::-webkit-slider-runnable-track {
          background: transparent;
        }
        .dual-range-input::-moz-range-track {
          background: transparent;
        }
      `}</style>
    </div>
  )
}
