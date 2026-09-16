export const BACK_BUTTON_ATTR = 'data-back-button'
export const SCREEN_ATTR = 'data-screen'

const TABBABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

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

export function getTopScreen(): HTMLElement | null {
  const screens = document.querySelectorAll<HTMLElement>(`[${SCREEN_ATTR}]`)
  const open = Array.from(screens).filter(el => !el.inert)
  return open.at(-1) ?? null
}

export function getTabbables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)
  ).filter(el => !el.closest('[inert]') && el.getClientRects().length > 0)
}

export function trapTab(event: KeyboardEvent): void {
  if (event.key !== 'Tab') return

  const screen = getTopScreen()
  if (!screen) return

  const tabbables = getTabbables(screen)
  if (tabbables.length === 0) {
    event.preventDefault()
    return
  }

  const first = tabbables[0]
  const last = tabbables[tabbables.length - 1]
  const active = document.activeElement
  const isInside = active instanceof Node && screen.contains(active)

  if (event.shiftKey) {
    if (!isInside || active === first) {
      event.preventDefault()
      last.focus()
    }
    return
  }

  if (!isInside || active === last) {
    event.preventDefault()
    first.focus()
  }
}
