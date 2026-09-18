import { useEffect, useRef, type ReactNode } from 'react'

import { CloseButton } from '../ui/back-button'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  variant?: 'sheet' | 'center'
  title?: string
  children: ReactNode
}

export default function Modal({
  isOpen,
  onClose,
  variant = 'sheet',
  title,
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
      className={`max-w-screen-sm mx-auto fixed inset-0 z-50 ${isOpen ? '' : 'pointer-events-none'}`}
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

      <div className={panelClass}>
        {title && (
          <div className={variant === 'center' ? 'relative mb-4' : 'mb-4'}>
            <h2
              className={`text-xl font-semibold text-center ${
                variant === 'center' ? 'px-10' : ''
              }`}
            >
              {title}
            </h2>
            {variant === 'center' && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2">
                <CloseButton onClose={onClose} />
              </div>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
