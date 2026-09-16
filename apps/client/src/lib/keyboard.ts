export const BACK_BUTTON_ATTR = 'data-back-button'

export interface ShortcutRule {
  id: string
  key: string
  mod?: boolean
  when?: 'notTyping' | 'always'
}

export const globalRules: ShortcutRule[] = [
  { id: 'back', key: 'Escape', when: 'notTyping' }
]

export function isMod(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target.closest('[role="slider"]')) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function matchShortcut(
  event: KeyboardEvent,
  rules: readonly ShortcutRule[]
): ShortcutRule | null {
  if (event.repeat) return null

  for (const rule of rules) {
    if (event.key !== rule.key) continue
    if (Boolean(rule.mod) !== isMod(event)) continue
    const when = rule.when ?? 'notTyping'
    if (when === 'notTyping' && isTypingTarget(event.target)) continue
    return rule
  }

  return null
}

function isInViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  )
}

export function clickBackButton(): void {
  const buttons = document.querySelectorAll<HTMLElement>(
    `[${BACK_BUTTON_ATTR}]`
  )
  const visible = Array.from(buttons).filter(isInViewport)
  visible.at(-1)?.click()
}
