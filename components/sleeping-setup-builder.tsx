'use client'

import { useEffect, useState, type ReactNode } from 'react'

// Room-by-room sleeping setup: one "Add a room" button opens a panel where the
// host picks the beds in that room; each saved room shows as a card beside it.
//
// It reads and writes the plain text stored in listings.sleeping_setup, one
// line per room ("Bedroom 1: 2 single beds with 1 pull-out, 1 sofa bed (fits 1)"),
// so every page that displays the setup keeps working. Text it cannot read as
// beds (older free text) is kept as the room's note, so nothing is lost.

type BedKey = 'bunk' | 'king' | 'queen' | 'single' | 'sofa'

type BedType = {
  key: BedKey
  label: string
  singular: string
  plural: string
  sleeps: number
  icon: ReactNode
}

const iconProps = {
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  className: 'h-full w-full',
}

const BED_TYPES: BedType[] = [
  {
    key: 'bunk',
    label: 'Bunk bed',
    singular: 'bunk bed',
    plural: 'bunk beds',
    sleeps: 2,
    icon: (
      <svg {...iconProps}>
        <path d="M7 5v39M41 5v39" />
        <rect x="7" y="13" width="34" height="6" rx="1.5" />
        <rect x="7" y="32" width="34" height="6" rx="1.5" />
        <rect x="10" y="9" width="8" height="4" rx="2" />
        <rect x="10" y="28" width="8" height="4" rx="2" />
        <path d="M30 19v13M36 19v13M30 23.5h6M30 28h6" strokeWidth={1.4} />
      </svg>
    ),
  },
  {
    key: 'king',
    label: 'King bed',
    singular: 'king bed',
    plural: 'king beds',
    sleeps: 2,
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="5" width="42" height="38" rx="3" />
        <path d="M3 10h42M3 25h42" />
        <rect x="6" y="12.5" width="17" height="6" rx="2.5" />
        <rect x="25" y="12.5" width="17" height="6" rx="2.5" />
        <path d="M6 25c3 3 33 3 36 0" strokeWidth={1.2} />
      </svg>
    ),
  },
  {
    key: 'queen',
    label: 'Queen bed',
    singular: 'queen bed',
    plural: 'queen beds',
    sleeps: 2,
    icon: (
      <svg {...iconProps}>
        <rect x="6" y="5" width="36" height="38" rx="3" />
        <path d="M6 10h36M6 25h36" />
        <rect x="9" y="12.5" width="14" height="6" rx="2.5" />
        <rect x="25" y="12.5" width="14" height="6" rx="2.5" />
        <path d="M9 25c3 3 27 3 30 0" strokeWidth={1.2} />
      </svg>
    ),
  },
  {
    key: 'single',
    label: 'Single bed',
    singular: 'single bed',
    plural: 'single beds',
    sleeps: 1,
    icon: (
      <svg {...iconProps}>
        <rect x="11" y="5" width="26" height="38" rx="3" />
        <path d="M11 10h26M11 25h26" />
        <rect x="16" y="12.5" width="16" height="6" rx="2.5" />
        <path d="M14 25c3 3 17 3 20 0" strokeWidth={1.2} />
      </svg>
    ),
  },
  {
    key: 'sofa',
    label: 'Sofa bed',
    singular: 'sofa bed',
    plural: 'sofa beds',
    sleeps: 2,
    icon: (
      <svg {...iconProps}>
        <rect x="9" y="13" width="30" height="11" rx="3" />
        <rect x="4" y="19" width="7" height="16" rx="3" />
        <rect x="37" y="19" width="7" height="16" rx="3" />
        <rect x="11" y="24" width="26" height="8" rx="1.5" />
        <path d="M11 35h26M8 35v4M40 35v4" />
        <path d="M24 24v8" strokeWidth={1.2} />
      </svg>
    ),
  },
]

const PULL_OUT_ICON = (
  <svg {...iconProps}>
    <path d="M5 10v26" />
    <rect x="5" y="15" width="36" height="7" rx="1.5" />
    <rect x="8" y="11" width="9" height="4" rx="2" />
    <path d="M5 22h36v4H5" />
    <rect x="11" y="28" width="33" height="8" rx="1.5" />
    <path d="M13 36v3M42 36v3M5 36v3" />
  </svg>
)

type BedEntry = { count: number; pulls: number; fits?: 1 | 2 }
type Beds = Partial<Record<BedKey, BedEntry>>
type Room = { id: number; name: string; beds: Beds; note: string }
type Editing = { id: number | null; name: string; beds: Beds; note: string }

let nextRoomId = 1

function bedSleeps(type: BedType, entry: BedEntry) {
  return type.key === 'sofa' ? entry.fits || 2 : type.sleeps
}

function roomSleeps(beds: Beds) {
  return BED_TYPES.reduce((total, type) => {
    const entry = beds[type.key]
    if (!entry || entry.count < 1) return total
    return total + entry.count * bedSleeps(type, entry) + entry.pulls
  }, 0)
}

function roomBedCount(beds: Beds) {
  return BED_TYPES.reduce((total, type) => total + (beds[type.key]?.count || 0), 0)
}

function describeBed(type: BedType, entry: BedEntry) {
  const name = `${entry.count} ${entry.count === 1 ? type.singular : type.plural}`
  const size = type.key === 'sofa' && entry.fits === 1 ? ' (fits 1)' : ''
  const pulls =
    entry.pulls > 0 ? ` with ${entry.pulls} ${entry.pulls === 1 ? 'pull-out' : 'pull-outs'}` : ''
  return `${name}${size}${pulls}`
}

function roomSummary(beds: Beds) {
  return BED_TYPES.filter((type) => (beds[type.key]?.count || 0) > 0)
    .map((type) => describeBed(type, beds[type.key]!))
    .join(', ')
}

const BED_PART =
  /^(\d+)\s+(bunk beds?|king beds?|queen beds?|single beds?|sofa beds?)(?:\s*\(fits ([12])\))?(?:\s+with\s+(\d+)\s+pull-outs?)?$/i

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
}

// Reads typed descriptions such as "bunkbed", "two single" or "couch bed with
// pullout" from before the builder existed. Returns null if it is not sure.
function parseLooseBed(part: string): { key: BedKey; entry: BedEntry } | null {
  const text = part.toLowerCase()
  const key: BedKey | null = /bunk/.test(text)
    ? 'bunk'
    : /sofa|couch/.test(text)
      ? 'sofa'
      : /king/.test(text)
        ? 'king'
        : /queen/.test(text)
          ? 'queen'
          : /single/.test(text)
            ? 'single'
            : null
  if (!key) return null

  const leading = text.match(/^\s*(\d+|[a-z]+)\b/)
  const count = leading
    ? /^\d+$/.test(leading[1])
      ? Number(leading[1])
      : NUMBER_WORDS[leading[1]] || 1
    : 1
  const pullMatch = text.match(/(\d+|[a-z]+)?\s*(?:pull[\s-]?outs?|trundles?)/)
  const pulls = pullMatch
    ? pullMatch[1] && /^\d+$/.test(pullMatch[1])
      ? Number(pullMatch[1])
      : NUMBER_WORDS[pullMatch[1] || ''] || 1
    : 0

  return { key, entry: { count, pulls, fits: key === 'sofa' ? 2 : undefined } }
}

function parseRooms(text: string): Room[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const colon = line.indexOf(':')
      const name = colon > 0 ? line.slice(0, colon).trim() : `Room ${index + 1}`
      const rest = colon > 0 ? line.slice(colon + 1) : line
      const beds: Beds = {}
      const notes: string[] = []

      rest
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => {
          const match = part.match(BED_PART)
          const type = match
            ? BED_TYPES.find((bed) => match[2].toLowerCase().startsWith(bed.singular))
            : undefined
          if (!match || !type) {
            const loose = parseLooseBed(part)
            if (!loose) {
              notes.push(part)
              return
            }
            const existing = beds[loose.key] || { count: 0, pulls: 0 }
            beds[loose.key] = {
              ...loose.entry,
              count: existing.count + loose.entry.count,
              pulls: existing.pulls + loose.entry.pulls,
            }
            return
          }
          const existing = beds[type.key] || { count: 0, pulls: 0 }
          beds[type.key] = {
            count: existing.count + Number(match[1]),
            pulls: existing.pulls + Number(match[4] || 0),
            fits: type.key === 'sofa' ? (match[3] === '1' ? 1 : 2) : undefined,
          }
        })

      return { id: nextRoomId++, name, beds, note: notes.join(', ') }
    })
}

function serializeRooms(rooms: Room[]) {
  return rooms
    .map((room) => {
      const parts = BED_TYPES.filter((type) => (room.beds[type.key]?.count || 0) > 0).map((type) =>
        describeBed(type, room.beds[type.key]!),
      )
      if (room.note.trim()) parts.push(room.note.trim())
      if (parts.length === 0) return ''
      return `${room.name.trim() || 'Room'}: ${parts.join(', ')}`
    })
    .filter(Boolean)
    .join('\n')
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

type SleepingSetupBuilderProps = {
  // Controlled use (React state).
  value?: string
  onChange?: (value: string) => void
  // Uncontrolled use inside a server-action form.
  name?: string
  defaultValue?: string
}

export function SleepingSetupBuilder({ value, onChange, name, defaultValue = '' }: SleepingSetupBuilderProps) {
  const [rooms, setRooms] = useState<Room[]>(() => parseRooms(value ?? defaultValue))
  const [lastSeenValue, setLastSeenValue] = useState(value)
  const [editing, setEditing] = useState<Editing | null>(null)

  // A controlled value can change from outside, e.g. a saved draft restored
  // after the first render. Rebuild the rooms when it no longer matches.
  if (value !== undefined && value !== lastSeenValue) {
    setLastSeenValue(value)
    if (value !== serializeRooms(rooms)) setRooms(parseRooms(value))
  }

  useEffect(() => {
    if (!editing) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditing(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editing])

  const commit = (nextRooms: Room[]) => {
    const text = serializeRooms(nextRooms)
    setRooms(nextRooms)
    setLastSeenValue(text)
    onChange?.(text)
  }

  const changeBed = (key: BedKey, change: (entry: BedEntry) => BedEntry) => {
    setEditing((current) => {
      if (!current) return current
      const beds = { ...current.beds }
      const next = change({ ...(beds[key] || { count: 0, pulls: 0 }) })
      next.pulls = Math.max(0, next.pulls)
      if (next.count < 1) delete beds[key]
      else beds[key] = next
      return { ...current, beds }
    })
  }

  const save = () => {
    if (!editing || roomBedCount(editing.beds) < 1) return
    const room: Room = {
      id: editing.id ?? nextRoomId++,
      name: editing.name.trim() || 'Room',
      beds: editing.beds,
      note: editing.note,
    }
    commit(
      editing.id === null
        ? [...rooms, room]
        : rooms.map((current) => (current.id === editing.id ? room : current)),
    )
    setEditing(null)
  }

  const totalSleeps = rooms.reduce((total, room) => total + roomSleeps(room.beds), 0)
  const totalBeds = rooms.reduce((total, room) => total + roomBedCount(room.beds), 0)
  const editingSleeps = editing ? roomSleeps(editing.beds) : 0
  const canSave = editing ? roomBedCount(editing.beds) > 0 : false

  return (
    <div>
      {name && <input type="hidden" name={name} value={serializeRooms(rooms)} />}

      {rooms.length > 0 && (
        <p className="mb-3 text-sm text-stone-600">
          {plural(rooms.length, 'room', 'rooms')} · {plural(totalBeds, 'bed', 'beds')} ·{' '}
          <span className="font-bold text-stone-900">sleeps {totalSleeps}</span>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          onClick={() =>
            setEditing({ id: null, name: `Room ${rooms.length + 1}`, beds: {}, note: '' })
          }
          className="flex min-h-[176px] flex-col items-center justify-center gap-3 rounded-[22px] border-2 border-dashed border-stone-300 bg-[#FCFAF8] p-5 text-stone-900 transition hover:border-[#c76f55]"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#c76f55] text-white">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M11 4v14M4 11h14" />
            </svg>
          </span>
          <span className="text-base font-bold">Add a room</span>
        </button>

        {rooms.map((room) => (
          <button
            key={room.id}
            type="button"
            onClick={() =>
              setEditing({
                id: room.id,
                name: room.name,
                beds: JSON.parse(JSON.stringify(room.beds)) as Beds,
                note: room.note,
              })
            }
            className="flex min-h-[176px] flex-col gap-4 rounded-[22px] border border-stone-200 bg-white p-5 text-left text-stone-900 transition hover:border-stone-400"
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="truncate text-base font-bold">{room.name}</span>
              <span className="text-sm font-semibold text-[#a95b45]">Edit</span>
            </span>
            <span className="flex flex-wrap gap-3">
              {BED_TYPES.filter((type) => (room.beds[type.key]?.count || 0) > 0).map((type) => {
                const entry = room.beds[type.key]!
                return (
                  <span
                    key={type.key}
                    className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FBF6F2] p-3 text-stone-700"
                  >
                    {type.icon}
                    {entry.count > 1 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-stone-900 px-1.5 text-xs font-bold text-white">
                        ×{entry.count}
                      </span>
                    )}
                    {entry.pulls > 0 && (
                      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#e3cbbd] bg-white px-2 py-0.5 text-[11px] font-bold text-[#7f4232]">
                        + {entry.pulls === 1 ? 'pull-out' : `${entry.pulls} pull-outs`}
                      </span>
                    )}
                  </span>
                )
              })}
            </span>
            <span className="mt-auto flex w-full items-end justify-between gap-2">
              <span className="text-sm text-stone-700">
                {roomSummary(room.beds)}
                {room.note && <span className="block text-xs text-stone-500">{room.note}</span>}
              </span>
              <span className="whitespace-nowrap rounded-full bg-[#fff1ea] px-2.5 py-1 text-xs font-bold text-[#7f4232]">
                Sleeps {roomSleeps(room.beds)}
              </span>
            </span>
          </button>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="sleeping-room-name-label">
          <div className="absolute inset-0 bg-stone-900/30" onClick={() => setEditing(null)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-[26px] bg-white shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[500px] md:rounded-none">
            <div className="flex items-start justify-between gap-4 px-5 pt-6 md:px-8 md:pt-7">
              <div className="min-w-0 flex-1">
                <label
                  id="sleeping-room-name-label"
                  htmlFor="sleeping-room-name"
                  className="text-xs font-bold uppercase tracking-widest text-stone-500"
                >
                  Room name
                </label>
                <input
                  id="sleeping-room-name"
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  className="mt-1 w-full border-0 border-b border-dashed border-stone-300 bg-transparent p-0 pb-0.5 text-2xl font-bold text-stone-900 outline-none focus:border-[#c76f55]"
                />
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-700 transition hover:border-stone-400"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 pb-4 pt-5 md:px-8">
              <p className="text-[15px] font-semibold text-stone-900">Choose the beds in this room</p>
              {BED_TYPES.map((type) => {
                const entry = editing.beds[type.key]
                const count = entry?.count || 0
                const pulls = entry?.pulls || 0
                const on = count > 0
                const isSofa = type.key === 'sofa'
                const sofaFits = entry?.fits || 2

                return (
                  <div
                    key={type.key}
                    className={`shrink-0 overflow-hidden rounded-[18px] ${
                      on ? 'border-2 border-[#c76f55] bg-[#FFF6F1]' : 'border border-stone-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 py-2.5 pl-3 pr-3.5">
                      <span className="h-12 w-12 shrink-0 text-stone-700">{type.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-stone-900">{type.label}</p>
                        {isSofa && on ? (
                          <div role="group" aria-label="How many each sofa bed fits" className="mt-1 flex gap-1.5">
                            {([1, 2] as const).map((fits) => (
                              <button
                                key={fits}
                                type="button"
                                onClick={() => changeBed('sofa', (current) => ({ ...current, fits }))}
                                aria-pressed={sofaFits === fits}
                                className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                                  sofaFits === fits
                                    ? 'border-stone-900 bg-stone-900 text-white'
                                    : 'border-stone-300 bg-white text-stone-900'
                                }`}
                              >
                                Fits {fits}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-stone-500">
                            {isSofa ? 'Fits 1 or 2' : `Fits ${type.sleeps}`}
                          </p>
                        )}
                      </div>
                      {on ? (
                        <Stepper
                          value={count}
                          label={type.singular}
                          onDecrease={() => changeBed(type.key, (current) => ({ ...current, count: current.count - 1 }))}
                          onIncrease={() => changeBed(type.key, (current) => ({ ...current, count: current.count + 1 }))}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => changeBed(type.key, (current) => ({ ...current, count: 1 }))}
                          className="rounded-full border border-stone-300 bg-white px-3.5 py-2 text-[13px] font-bold text-stone-900 transition hover:border-stone-500"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                    {on && (
                      <div className="flex items-center gap-3 border-t border-[#f3dccf] py-2 pl-3 pr-3.5 md:pl-[74px]">
                        <span className="h-7 w-7 shrink-0 text-stone-700">{PULL_OUT_ICON}</span>
                        <p className="min-w-0 flex-1 text-sm text-stone-900">
                          Pull-out beds underneath <span className="text-stone-500">· each fits 1 more</span>
                        </p>
                        <Stepper
                          small
                          value={pulls}
                          label="pull-out bed"
                          onDecrease={() => changeBed(type.key, (current) => ({ ...current, pulls: current.pulls - 1 }))}
                          onIncrease={() => changeBed(type.key, (current) => ({ ...current, pulls: current.pulls + 1 }))}
                        />
                      </div>
                    )}
                  </div>
                )
              })}

              {editing.note && (
                <label className="mt-2 block text-sm font-semibold text-stone-700">
                  Other details
                  <input
                    value={editing.note}
                    onChange={(event) => setEditing({ ...editing, note: event.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm font-normal text-stone-900 outline-none focus:border-[#c76f55]"
                  />
                </label>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-stone-100 px-5 pb-6 pt-4 md:px-8">
              <div>
                <p className="text-[13px] text-stone-500">This room sleeps</p>
                <p className="text-xl font-bold text-stone-900">{plural(editingSleeps, 'guest', 'guests')}</p>
              </div>
              <div className="flex items-center gap-1">
                {editing.id !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      commit(rooms.filter((room) => room.id !== editing.id))
                      setEditing(null)
                    }}
                    className="px-3 py-3 text-sm font-semibold text-rose-700 transition hover:text-rose-900"
                  >
                    Remove room
                  </button>
                )}
                <button
                  type="button"
                  onClick={save}
                  disabled={!canSave}
                  className="rounded-full bg-stone-900 px-7 py-3.5 text-[15px] font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stepper({
  value,
  label,
  onDecrease,
  onIncrease,
  small = false,
}: {
  value: number
  label: string
  onDecrease: () => void
  onIncrease: () => void
  small?: boolean
}) {
  const size = small ? 'h-[30px] w-[30px] text-base' : 'h-[34px] w-[34px] text-[17px]'
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onDecrease}
        disabled={value < 1}
        aria-label={`One fewer ${label}`}
        className={`${size} rounded-full border border-stone-300 bg-white text-stone-900 transition hover:border-stone-500 disabled:opacity-30`}
      >
        −
      </button>
      <span className="w-4 text-center text-[15px] font-bold text-stone-900">{value}</span>
      <button
        type="button"
        onClick={onIncrease}
        aria-label={`One more ${label}`}
        className={`${size} rounded-full border border-stone-300 bg-white text-stone-900 transition hover:border-stone-500`}
      >
        +
      </button>
    </div>
  )
}
