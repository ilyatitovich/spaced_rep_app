import type { TouchEvent } from 'react'
import { useRef, useCallback } from 'react'

type UseTapOptions = {
  maxDistance?: number // px
  maxDuration?: number // ms
}

export function useTap(callback?: () => void, options: UseTapOptions = {}) {
  const { maxDistance = 10, maxDuration = 250 } = options

  const startX = useRef(0)
  const startY = useRef(0)
  const startTime = useRef(0)

  const onTouchStart = useCallback((e: TouchEvent) => {
    const t = e.touches[0]
    startX.current = t.clientX
    startY.current = t.clientY
    startTime.current = Date.now()
  }, [])

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      const t = e.changedTouches[0]
      const dx = Math.abs(t.clientX - startX.current)
      const dy = Math.abs(t.clientY - startY.current)
      const dt = Date.now() - startTime.current

      const moved = dx > maxDistance || dy > maxDistance
      const longPress = dt > maxDuration

      if (!moved && !longPress) {
        callback?.() // it was a TAP
      }
    },
    [callback, maxDistance, maxDuration]
  )

  return { onTouchStart, onTouchEnd }
}
