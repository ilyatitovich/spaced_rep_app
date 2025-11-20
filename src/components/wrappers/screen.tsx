import type { ReactNode } from 'react'
import { useState, useRef, useEffect } from 'react'

type ScreenProps = {
  isOpen: boolean
  isHorizontal?: boolean
  onHide: () => void
  onOpen: () => void
  children: ReactNode
}

export default function Screen({
  isOpen,
  isHorizontal = true,
  onHide,
  onOpen,
  children
}: ScreenProps) {
  const [isInitialRender, setIsInitialRender] = useState(true)
  const screenRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = screenRef.current
    if (!node || isInitialRender) return

    if (!isOpen) {
      node.addEventListener('transitionend', onHide, { once: true })
    }
  }, [isOpen, isInitialRender, onHide])

  useEffect(() => {
    if (!isOpen) return

    onOpen()

    if (isInitialRender) {
      setIsInitialRender(false)
    }
  }, [isOpen, isInitialRender, onOpen])

  return (
    <div
      ref={screenRef}
      className={`${isOpen ? `translate-${isHorizontal ? 'x' : 'y'}-0` : `translate-${isHorizontal ? 'x' : 'y'}-full`} transition-transform duration-300 ease-in-out fixed inset-0 z-50 bg-background`}
    >
      {children}
    </div>
  )
}
