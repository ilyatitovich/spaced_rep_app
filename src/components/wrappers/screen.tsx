import type { ReactNode } from 'react'
import { useState, useEffect } from 'react'

type ScreenProps = {
  isOpen: boolean
  isVertical?: boolean
  onClose?: () => void
  onOpen?: () => void
  children: ReactNode
}

export default function Screen({
  isOpen,
  isVertical = false,
  onClose,
  onOpen,
  children
}: ScreenProps) {
  const [isInitialRender, setIsInitialRender] = useState(true)

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
      className={`${
        isOpen
          ? isVertical
            ? 'translate-y-0'
            : 'translate-x-0'
          : isVertical
            ? 'translate-y-[100vh]'
            : 'translate-x-[100vw]'
      } transition-transform duration-300 ease-in-out fixed inset-0 z-50 bg-background`}
      onTransitionEnd={handleTransitionEnd}
    >
      {!isInitialRender && children}
    </div>
  )
}
