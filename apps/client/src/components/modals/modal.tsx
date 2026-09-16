import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  variant?: 'sheet' | 'center'
  children: ReactNode
}

export default function Modal({
  isOpen,
  onClose,
  variant = 'sheet',
  children
}: ModalProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (rootRef.current) rootRef.current.inert = !isOpen
  }, [isOpen])

  const panelClass =
    variant === 'center'
      ? `absolute top-1/2 left-4 right-4 z-50 bg-card rounded-3xl p-6 flex flex-col gap-4 transition-[opacity,translate] duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isOpen
            ? '-translate-y-1/2 opacity-100 starting:-translate-y-[30%] starting:opacity-0'
            : '-translate-y-[30%] opacity-0'
        }`
      : `absolute bottom-4 left-4 right-4 z-50 bg-card rounded-3xl p-6 transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isOpen
            ? 'translate-y-0 starting:translate-y-[110%]'
            : 'translate-y-[110%]'
        }`

  return (
    <div
      ref={rootRef}
      data-screen=""
      className={`fixed inset-0 z-50 ${isOpen ? '' : 'pointer-events-none'}`}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        data-dismiss=""
        className={`absolute inset-0 bg-background-overlay transition-opacity duration-300 ${
          isOpen ? 'opacity-100 starting:opacity-0' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      <div className={panelClass}>{children}</div>
    </div>
  )
}
