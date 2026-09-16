import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'

import { removeLastSearchParam } from '@/lib'
import {
  dismissTop,
  globalRules,
  matchShortcut,
  trapTab,
  type ShortcutRule
} from '@/lib/keyboard'

export function useShortcuts(
  rules: readonly ShortcutRule[],
  handlers: Record<string, () => void>,
  {
    enabled = true,
    capture = false
  }: { enabled?: boolean; capture?: boolean } = {}
): void {
  const rulesRef = useRef(rules)
  const handlersRef = useRef(handlers)
  rulesRef.current = rules
  handlersRef.current = handlers

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const rule = matchShortcut(event, rulesRef.current)
      if (!rule) return
      const handler = handlersRef.current[rule.id]
      if (!handler) return
      event.preventDefault()
      handler()
    }

    window.addEventListener('keydown', handleKeyDown, capture)
    return () => window.removeEventListener('keydown', handleKeyDown, capture)
  }, [enabled, capture])
}

export function useKeyboardManager(): void {
  const [, setSearchParams] = useSearchParams()

  useShortcuts(globalRules, {
    back: () => {
      if (dismissTop()) return
      setSearchParams(prev => removeLastSearchParam(prev))
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', trapTab)
    return () => window.removeEventListener('keydown', trapTab)
  }, [])
}
