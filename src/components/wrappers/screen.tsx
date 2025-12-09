import type { ReactNode } from 'react'
import { useEffect } from 'react'

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
  useEffect(() => {
    if (!isOpen) return

    onOpen?.()
  }, [isOpen, onOpen])

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
      {children}
    </div>
  )
}
