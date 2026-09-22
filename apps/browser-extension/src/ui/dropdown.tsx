import { useEffect, useRef, type ReactNode } from 'react'

interface DropdownProps {
  isOpen: boolean
  onClose: () => void
  trigger: ReactNode
  children: ReactNode
}

export default function Dropdown({
  isOpen,
  onClose,
  trigger,
  children
}: DropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen, onClose])

  return (
    <div ref={rootRef} className="relative">
      {trigger}
      {isOpen && (
        <div
          role="menu"
          className="absolute left-1/2 top-full z-50 mt-1 min-w-36 -translate-x-1/2 rounded-xl border border-border bg-card p-1 shadow-md"
        >
          {children}
        </div>
      )}
    </div>
  )
}
