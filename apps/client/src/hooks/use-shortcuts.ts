import { useEffect, useRef } from 'react'

import {
  clickBackButton,
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
  useShortcuts(globalRules, { back: clickBackButton })

  useEffect(() => {
    window.addEventListener('keydown', trapTab)
    return () => window.removeEventListener('keydown', trapTab)
  }, [])
}
