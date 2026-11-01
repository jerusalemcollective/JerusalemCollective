'use client'

import { useState } from 'react'

// Room-by-room sleeping setup. It reads and writes the same plain-text format
// stored in listings.sleeping_setup ("Bedroom 1: 1 king bed, 2 single beds"),
// so every page that displays the setup keeps working unchanged.

const BED_TYPES = [
  { key: 'king', label: 'King', singular: 'king bed', plural: 'king beds', sleeps: 2 },
  { key: 'queen', label: 'Queen', singular: 'queen bed', plural: 'queen beds', sleeps: 2 },
  { key: 'double', label: 'Double', singular: 'double bed', plural: 'double beds', sleeps: 2 },
  { key: 'single', label: 'Single', singular: 'single bed', plural: 'single beds', sleeps: 1 },
  { key: 'bunk', label: 'Bunk bed', singular: 'bunk bed', plural: 'bunk beds', sleeps: 2 },
  { key: 'sofa', label: 'Sofa bed', singular: 'sofa bed', plural: 'sofa beds', sleeps: 2 },
  { key: 'pullout', label: 'Pull-out bed', singular: 'pull-out bed', plural: 'pull-out beds', sleeps: 1 },
  { key: 'crib', label: 'Crib', singular: 'crib', plural: 'cribs', sleeps: 0 },
] as const

type BedKey = (typeof BED_TYPES)[number]['key']

type Room = {
  id: number
  name: string
  beds: Partial<Record<BedKey, number>>
  note: string
}

let nextRoomId = 1

function newRoom(name: string): Room {
  return { id: nextRoomId++, name, beds: {}, note: '' }
}

function parseBedPart(part: string): { key: BedKey; count: number } | null {
  const match = part.trim().toLowerCase().match(/^(\d+)\s+(.+)$/)
  if (!match) return null
  const label = match[2].trim()
  const bed = BED_TYPES.find((type) => type.singular === label || type.plural === label)
  return bed ? { key: bed.key, count: Number(match[1]) } : null
}

// Lines this builder wrote parse back exactly. Anything else (older free text)
// is kept as the room's note, so nothing a host wrote is lost.
function parseRooms(value: string): Room[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const colon = line.indexOf(':')
      const name = colon > 0 ? line.slice(0, colon).trim() : `Room ${index + 1}`
      const rest = colon > 0 ? line.slice(colon + 1) : line
      const room = newRoom(name)
      const notes: string[] = []

      rest
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => {
          const bed = parseBedPart(part)
          if (bed) {
            room.beds[bed.key] = (room.beds[bed.key] || 0) + bed.count
          } else {
            notes.push(part)
          }
        })

      room.note = notes.join(', ')
      return room
    })
}

function roomsFromText(text: string) {
  const parsed = parseRooms(text)
  return parsed.length > 0 ? parsed : [newRoom('Bedroom 1')]
}

function serializeRooms(rooms: Room[]) {
  return rooms
    .map((room) => {
      const parts = BED_TYPES.filter((type) => (room.beds[type.key] || 0) > 0).map((type) => {
        const count = room.beds[type.key] || 0
        return `${count} ${count === 1 ? type.singular : type.plural}`
      })
      if (room.note.trim()) parts.push(room.note.trim())
      if (parts.length === 0) return ''
      return `${room.name.trim() || 'Room'}: ${parts.join(', ')}`
    })
    .filter(Boolean)
    .join('\n')
}

function roomCapacity(rooms: Room[]) {
  return rooms.reduce(
    (total, room) =>
      total + BED_TYPES.reduce((sum, type) => sum + (room.beds[type.key] || 0) * type.sleeps, 0),
    0,
  )
}

function nextRoomName(rooms: Room[], base: 'Bedroom' | 'Living room') {
  if (base === 'Living room') {
    return rooms.some((room) => room.name === 'Living room') ? 'Living room 2' : 'Living room'
  }
  const bedroomCount = rooms.filter((room) => room.name.startsWith('Bedroom')).length
  return `Bedroom ${bedroomCount + 1}`
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
  const [rooms, setRooms] = useState<Room[]>(() => roomsFromText(value ?? defaultValue))
  const [lastSeenValue, setLastSeenValue] = useState(value)

  // A controlled value can change from outside, e.g. a saved draft restored
  // after the first render. Rebuild the rooms when it no longer matches.
  if (value !== undefined && value !== lastSeenValue) {
    setLastSeenValue(value)
    if (value !== serializeRooms(rooms)) setRooms(roomsFromText(value))
  }

  const update = (nextRooms: Room[]) => {
    const text = serializeRooms(nextRooms)
    setRooms(nextRooms)
    setLastSeenValue(text)
    onChange?.(text)
  }

  const updateRoom = (id: number, change: (room: Room) => Room) => {
    update(rooms.map((room) => (room.id === id ? change(room) : room)))
  }

  const changeBedCount = (id: number, key: BedKey, delta: number) => {
    updateRoom(id, (room) => ({
      ...room,
      beds: { ...room.beds, [key]: Math.max(0, (room.beds[key] || 0) + delta) },
    }))
  }

  const capacity = roomCapacity(rooms)

  return (
    <div className="space-y-4">
      {name && <input type="hidden" name={name} value={serializeRooms(rooms)} />}

      {rooms.map((room) => (
        <div key={room.id} className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <input
              value={room.name}
              onChange={(event) => updateRoom(room.id, (current) => ({ ...current, name: event.target.value }))}
              aria-label="Room name"
              className="min-w-0 flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm font-bold text-stone-900 outline-none focus:border-[#c76f55]"
            />
            {rooms.length > 1 && (
              <button
                type="button"
                onClick={() => update(rooms.filter((current) => current.id !== room.id))}
                className="shrink-0 rounded-full px-3 py-2 text-xs font-semibold text-stone-500 transition hover:text-rose-600"
              >
                Remove
              </button>
            )}
          </div>

          {BED_TYPES.some((type) => (room.beds[type.key] || 0) > 0) && (
            <div className="mt-3 space-y-2">
              {BED_TYPES.filter((type) => (room.beds[type.key] || 0) > 0).map((type) => {
                const count = room.beds[type.key] || 0
                return (
                  <div key={type.key} className="flex items-center justify-between rounded-xl bg-[#fff4ef] px-3 py-2">
                    <span className="text-sm font-semibold capitalize text-stone-800">{type.singular}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changeBedCount(room.id, type.key, -1)}
                        aria-label={`Remove a ${type.singular}`}
                        className="h-8 w-8 rounded-full border border-stone-300 bg-white text-base font-bold text-stone-700 transition hover:border-stone-500"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm font-bold text-stone-900">{count}</span>
                      <button
                        type="button"
                        onClick={() => changeBedCount(room.id, type.key, 1)}
                        aria-label={`Add a ${type.singular}`}
                        className="h-8 w-8 rounded-full border border-stone-300 bg-white text-base font-bold text-stone-700 transition hover:border-stone-500"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-3">
            <p className="text-xs font-semibold text-stone-500">Add a bed</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {BED_TYPES.map((type) => (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => changeBedCount(room.id, type.key, 1)}
                  className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:border-[#c76f55] hover:text-[#a95b45]"
                >
                  + {type.label}
                </button>
              ))}
            </div>
          </div>

          <input
            value={room.note}
            onChange={(event) => updateRoom(room.id, (current) => ({ ...current, note: event.target.value }))}
            placeholder="Anything else about this room (optional), e.g. en-suite bathroom"
            className="mt-3 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-[#c76f55]"
          />
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => update([...rooms, newRoom(nextRoomName(rooms, 'Bedroom'))])}
          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-800 transition hover:border-stone-500"
        >
          + Add a bedroom
        </button>
        <button
          type="button"
          onClick={() => update([...rooms, newRoom(nextRoomName(rooms, 'Living room'))])}
          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-800 transition hover:border-stone-500"
        >
          + Add a living room
        </button>
        {capacity > 0 && (
          <p className="ml-auto text-sm text-stone-600">
            These beds sleep <span className="font-bold text-stone-900">{capacity}</span>
          </p>
        )}
      </div>
    </div>
  )
}
