import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

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
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    onOpen?.()
  }, [isOpen, onOpen])

  const handleTransitionEnd = () => {
    if (isOpen) {
      setIsMounted(true)
      return
    }
    onClose?.()
    setIsMounted(false)
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
      } transition-transform duration-300 ease-in-out will-change-transform fixed inset-0 z-50 bg-background`}
      onTransitionEnd={handleTransitionEnd}
    >
      <div
        className={`${isMounted ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 ease-in-out`}
      >
        {isMounted && children}
      </div>
    </div>
  )
}
