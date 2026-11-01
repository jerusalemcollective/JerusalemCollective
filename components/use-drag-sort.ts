'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

// Drag-to-reorder for a grid of items, with pointer events only (no native
// HTML drag and drop, which fought the pointer handling before).
//
// - Mouse and pen: press anywhere on an item and drag.
// - Touch: drag from the item's handle (touch-action: none), so a swipe on
//   the photo itself still scrolls the page.
//
// Items must carry data-sort-index={index}. onMove fires each time the dragged
// item passes over another one, so the list reorders live; onDrop fires once
// at the end, when the order can be saved.

type DragState = {
  pointerId: number
  startX: number
  startY: number
  index: number
  moved: boolean
}

const START_DISTANCE = 6

export function useDragSort({
  onMove,
  onDrop,
}: {
  onMove: (fromIndex: number, toIndex: number) => void
  onDrop?: () => void
}) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const callbacks = useRef({ onMove, onDrop })
  callbacks.current = { onMove, onDrop }

  useEffect(() => {
    function handleMove(event: PointerEvent) {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return

      if (!drag.moved) {
        const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
        if (distance < START_DISTANCE) return
        drag.moved = true
        setDraggingIndex(drag.index)
        document.body.style.userSelect = 'none'
      }

      event.preventDefault()
      const under = document.elementFromPoint(event.clientX, event.clientY)
      const item = under instanceof Element ? under.closest('[data-sort-index]') : null
      const targetIndex = item ? Number(item.getAttribute('data-sort-index')) : Number.NaN
      if (!Number.isInteger(targetIndex) || targetIndex === drag.index) return

      callbacks.current.onMove(drag.index, targetIndex)
      drag.index = targetIndex
      setDraggingIndex(targetIndex)
    }

    function handleEnd(event: PointerEvent) {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      dragRef.current = null
      document.body.style.userSelect = ''
      setDraggingIndex(null)
      if (drag.moved) callbacks.current.onDrop?.()
    }

    window.addEventListener('pointermove', handleMove, { passive: false })
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
    }
  }, [])

  function start(index: number, event: ReactPointerEvent<HTMLElement>, fromHandle: boolean) {
    if (event.button !== 0 || dragRef.current) return
    if (event.pointerType === 'touch' && !fromHandle) return
    const target = event.target as HTMLElement | null
    if (!fromHandle && target?.closest('button, input, textarea, select, a, label')) return
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      index,
      moved: false,
    }
  }

  return {
    draggingIndex,
    // Spread on each item.
    itemProps: (index: number) => ({
      'data-sort-index': index,
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => start(index, event, false),
    }),
    // Spread on the item's drag handle (needed for touch).
    handleProps: (index: number) => ({
      'aria-label': 'Drag to reorder',
      style: { touchAction: 'none' } as const,
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        event.stopPropagation()
        start(index, event, true)
      },
    }),
  }
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}
