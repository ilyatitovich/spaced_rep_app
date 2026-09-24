import type { ReactNode, TransitionEvent } from 'react'
import { useState, useEffect, useLayoutEffect, useId, useRef } from 'react'

import BackButton from '@/components/ui/back-button'
import Button from '@/components/ui/button'
import { useShouldAnimate } from '@/hooks/use-should-animate'
import { useScreenStackStore } from '@/store/screen-stack-store'

import { ErrorBoundary, type ErrorFallbackProps } from './error-boundary'

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

function ScreenErrorFallback({ onRetry }: ErrorFallbackProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 px-4">
      <h1 className="font-bold text-2xl">Something went wrong</h1>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
        <BackButton icon="x" />
      </div>
    </div>
  )
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
  const [errorResetKey, setErrorResetKey] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)
  const pendingOpenRef = useRef(false)
  const onOpenRef = useRef(onOpen)
  const onCloseRef = useRef(onClose)
  const shouldDisableAnimation = !useShouldAnimate()

  onOpenRef.current = onOpen
  onCloseRef.current = onClose

  useEffect(() => {
    if (rootRef.current) rootRef.current.inert = !isOpen
  }, [isOpen])

  useEffect(() => {
    const justOpened = !wasOpenRef.current && isOpen
    const justClosed = wasOpenRef.current && !isOpen
    wasOpenRef.current = isOpen

    if (justOpened) {
      pendingOpenRef.current = true
      setIsInitialRender(false)
    }
    if (justClosed && shouldDisableAnimation) onCloseRef.current?.()
  }, [isOpen, shouldDisableAnimation])

  useLayoutEffect(() => {
    if (!isOpen || isInitialRender || !pendingOpenRef.current) return
    pendingOpenRef.current = false
    onOpenRef.current?.()
  }, [isOpen, isInitialRender])

  useEffect(() => {
    if (!isOpen) return
    setErrorResetKey(key => key + 1)
  }, [isOpen])

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
        <ErrorBoundary
          resetKey={errorResetKey}
          fallback={<ScreenErrorFallback />}
        >
          {!isInitialRender && children}
        </ErrorBoundary>
      </ScreenLayer>
    </div>
  )
}
