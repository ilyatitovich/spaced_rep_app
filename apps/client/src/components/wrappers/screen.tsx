import type { ReactNode, TransitionEvent } from 'react'
import { useState, useEffect, useId, useRef } from 'react'

import { useScreenStackStore } from '@/store/screen-stack-store'
import { useShouldAnimate } from '@/hooks'

type ScreenLayerProps = {
  isOpen?: boolean
  className?: string
  children: ReactNode
}

export function ScreenLayer({
  isOpen = true,
  className = 'h-full',
  children
}: ScreenLayerProps) {
  const id = useId()
  const push = useScreenStackStore(state => state.push)
  const pop = useScreenStackStore(state => state.pop)
  const isBehind = useScreenStackStore(state => {
    const index = state.stack.indexOf(id)
    return index !== -1 && index < state.stack.length - 1
  })
  const shouldAnimate = useShouldAnimate()

  const animationClass = shouldAnimate
    ? 'transition-transform duration-300 ease-in-out'
    : 'transition-none'

  useEffect(() => {
    if (!isOpen) return
    push(id)
    return () => pop(id)
  }, [id, isOpen, pop, push])

  if (!shouldAnimate) {
    return <div className={`${className}`}>{children}</div>
  }

  return (
    <div
      className={`${className} ${animationClass} ${
        isBehind ? '-translate-x-1/4' : 'translate-x-0'
      }`}
    >
      {children}
    </div>
  )
}

type ScreenProps = {
  isOpen: boolean
  isVertical?: boolean
  onClose?: () => void
  onOpen?: () => void
  className?: string
  children: ReactNode
}

export default function Screen({
  isOpen,
  isVertical = false,
  onClose,
  onOpen,
  className = 'z-50',
  children
}: ScreenProps) {
  const [isInitialRender, setIsInitialRender] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(isOpen)
  const shouldDisableAnimation = !useShouldAnimate()

  useEffect(() => {
    if (rootRef.current) rootRef.current.inert = !isOpen
  }, [isOpen])

  useEffect(() => {
    const justClosed = wasOpenRef.current && !isOpen
    wasOpenRef.current = isOpen
    if (justClosed && shouldDisableAnimation) onClose?.()
  }, [isOpen, shouldDisableAnimation, onClose])

  useEffect(() => {
    if (!isOpen) return

    onOpen?.()

    if (isInitialRender) {
      setIsInitialRender(false)
    }
  }, [isInitialRender, isOpen, onOpen])

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (shouldDisableAnimation) return
    if (event.target !== event.currentTarget) return
    if (isOpen) return
    onClose?.()
  }

  const animationClass = shouldDisableAnimation
    ? 'transition-none'
    : 'transition-transform duration-300 ease-in-out'

  const onscreenClass = isVertical ? 'translate-y-0' : 'translate-x-0'
  const offscreenClass = isVertical
    ? 'translate-y-[100vh]'
    : 'translate-x-[100vw]'

  return (
    <div
      ref={rootRef}
      data-screen=""
      className={`${isOpen ? onscreenClass : offscreenClass} ${animationClass} fixed inset-0 max-w-screen-sm mx-auto bg-background overflow-hidden ${className}`.trim()}
      onTransitionEnd={handleTransitionEnd}
    >
      <ScreenLayer isOpen={isOpen && !isVertical}>
        {!isInitialRender && children}
      </ScreenLayer>
    </div>
  )
}
