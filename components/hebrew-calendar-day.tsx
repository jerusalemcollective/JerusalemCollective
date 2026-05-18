'use client'

import { DayButton } from 'react-day-picker'
import { formatHebrewDay } from '@/lib/hebrew-date'
import { cn } from '@/lib/utils'

export function HebrewCalendarDayButton({
  className,
  day,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  return (
    <DayButton
      day={day}
      className={cn('flex flex-col items-center justify-center leading-none', className)}
      {...props}
    >
      <span>{day.date.getDate()}</span>
      <span className="mt-0.5 text-[9px] font-medium opacity-60">
        {formatHebrewDay(day.date)}
      </span>
    </DayButton>
  )
}
