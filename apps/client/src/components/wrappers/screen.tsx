import type { ReactNode } from 'react'
import { useState, useEffect, useRef } from 'react'

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

  useEffect(() => {
    if (rootRef.current) rootRef.current.inert = !isOpen
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    onOpen?.()

    if (isInitialRender) {
      setIsInitialRender(false)
    }
  }, [isInitialRender, isOpen, onOpen])

  const handleTransitionEnd = () => {
    if (isOpen) return
    onClose?.()
  }

  return (
    <div
      ref={rootRef}
      data-screen=""
      className={`${
        isOpen
          ? isVertical
            ? 'translate-y-0'
            : 'translate-x-0'
          : isVertical
            ? 'translate-y-[100vh]'
            : 'translate-x-[100vw]'
      } transition-transform duration-300 ease-in-out fixed inset-0 bg-background ${className}`.trim()}
      onTransitionEnd={handleTransitionEnd}
    >
      {!isInitialRender && children}
    </div>
  )
}
