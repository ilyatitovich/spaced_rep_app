import { useEffect, useRef } from 'react'

import { LEVELS, levelLabel } from '@/lib'

type MoveToLevelModalProps = {
  isOpen: boolean
  onClose: () => void
  onSelect: (level: number) => void
  currentLevel: number
}

export default function MoveToLevelModal({
  isOpen,
  onClose,
  onSelect,
  currentLevel
}: MoveToLevelModalProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (rootRef.current) rootRef.current.inert = !isOpen
  }, [isOpen])

  return (
    <div
      ref={rootRef}
      className={`fixed inset-0 z-50 ${isOpen ? '' : 'pointer-events-none'}`}
    >
      <button
        type="button"
        aria-label="Close"
        className={`absolute inset-0 bg-background-overlay transition-opacity duration-300 ${
          isOpen ? 'opacity-100 starting:opacity-0' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      <div
        className={`absolute bottom-4 left-4 right-4 z-50 bg-card rounded-3xl p-6 transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isOpen
            ? 'translate-y-0 starting:translate-y-[110%]'
            : 'translate-y-[110%]'
        }`}
      >
        <h2 className="text-xl font-semibold text-center mb-4">
          Move to level
        </h2>

        <ul className="flex flex-col gap-3">
          {LEVELS.map(level => {
            const isCurrent = level === currentLevel
            return (
              <li key={level}>
                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => {
                    onSelect(level)
                    onClose()
                  }}
                  className="w-full flex items-center justify-center py-4 px-4 rounded-xl text-left text-primary
                  bg-muted disabled:text-foreground-subtle disabled:opacity-50 active:bg-secondary"
                >
                  {levelLabel(level)}
                  {isCurrent ? ' (current)' : ''}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
