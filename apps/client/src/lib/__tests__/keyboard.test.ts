import { describe, expect, it, vi } from 'vitest'

import {
  carouselRules,
  DISMISS_ATTR,
  dismissTop,
  getTabbables,
  globalRules,
  matchShortcut,
  SCREEN_ATTR,
  trapTab
} from '../keyboard'

function keydown(
  key: string,
  init: KeyboardEventInit & { target?: EventTarget } = {}
) {
  const { target, ...rest } = init
  const event = new KeyboardEvent('keydown', { key, ...rest })
  if (target) {
    Object.defineProperty(event, 'target', { value: target })
  }
  return event
}

function placeInViewport(el: HTMLElement, left = 8) {
  const rect = {
    width: 40,
    height: 40,
    top: 8,
    left,
    bottom: 48,
    right: left + 40,
    x: left,
    y: 8,
    toJSON() {}
  } as DOMRect
  el.getBoundingClientRect = () => rect
  el.getClientRects = () => [rect] as unknown as DOMRectList
}

function tabEvent(shift = false) {
  return new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey: shift,
    bubbles: true,
    cancelable: true
  })
}

describe('matchShortcut', () => {
  it('matches Escape to the back rule', () => {
    expect(matchShortcut(keydown('Escape'), globalRules)?.id).toBe('back')
  })

  it('ignores Escape while typing in an input', () => {
    const input = document.createElement('input')
    expect(
      matchShortcut(keydown('Escape', { target: input }), globalRules)
    ).toBeNull()
  })

  it('ignores held-down Escape repeats', () => {
    expect(
      matchShortcut(keydown('Escape', { repeat: true }), globalRules)
    ).toBeNull()
  })

  it('ignores Escape with a modifier', () => {
    expect(
      matchShortcut(keydown('Escape', { ctrlKey: true }), globalRules)
    ).toBeNull()
  })

  it('matches ArrowLeft and ArrowRight to carousel rules', () => {
    expect(matchShortcut(keydown('ArrowLeft'), carouselRules)?.id).toBe(
      'prevCard'
    )
    expect(matchShortcut(keydown('ArrowRight'), carouselRules)?.id).toBe(
      'nextCard'
    )
  })

  it('ignores carousel arrows while typing', () => {
    const input = document.createElement('input')
    expect(
      matchShortcut(keydown('ArrowLeft', { target: input }), carouselRules)
    ).toBeNull()
  })
})

describe('dismissTop', () => {
  it('closes the top overlay and leaves the screen underneath', () => {
    const screen = document.createElement('div')
    screen.setAttribute(SCREEN_ATTR, '')

    const modal = document.createElement('div')
    modal.setAttribute(SCREEN_ATTR, '')
    const close = document.createElement('button')
    close.setAttribute(DISMISS_ATTR, '')
    modal.append(close)

    document.body.append(screen, modal)

    const onClose = vi.fn()
    close.addEventListener('click', onClose)

    expect(dismissTop()).toBe(true)
    expect(onClose).toHaveBeenCalledOnce()

    screen.remove()
    modal.remove()
  })

  it('returns false when the top layer is a screen', () => {
    const screen = document.createElement('div')
    screen.setAttribute(SCREEN_ATTR, '')
    document.body.append(screen)

    expect(dismissTop()).toBe(false)

    screen.remove()
  })

  it('ignores a closed modal nested inside the current screen', () => {
    const screen = document.createElement('div')
    screen.setAttribute(SCREEN_ATTR, '')
    const modal = document.createElement('div')
    modal.setAttribute(SCREEN_ATTR, '')
    modal.inert = true
    const close = document.createElement('button')
    close.setAttribute(DISMISS_ATTR, '')
    modal.append(close)
    screen.append(modal)
    document.body.append(screen)

    const onClose = vi.fn()
    close.addEventListener('click', onClose)

    expect(dismissTop()).toBe(false)
    expect(onClose).not.toHaveBeenCalled()

    screen.remove()
  })
})

describe('trapTab', () => {
  it('wraps Tab from the last control to the first on the top screen', () => {
    const behind = document.createElement('div')
    const top = document.createElement('div')
    behind.setAttribute(SCREEN_ATTR, '')
    top.setAttribute(SCREEN_ATTR, '')

    const prev = document.createElement('button')
    const first = document.createElement('button')
    const last = document.createElement('button')
    behind.append(prev)
    top.append(first, last)
    document.body.append(behind, top)
    for (const el of [behind, top, prev, first, last]) placeInViewport(el)

    last.focus()
    const event = tabEvent()
    trapTab(event)

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)

    behind.remove()
    top.remove()
  })

  it('wraps Shift+Tab from the first control to the last', () => {
    const top = document.createElement('div')
    top.setAttribute(SCREEN_ATTR, '')
    const first = document.createElement('button')
    const last = document.createElement('button')
    top.append(first, last)
    document.body.append(top)
    for (const el of [top, first, last]) placeInViewport(el)

    first.focus()
    const event = tabEvent(true)
    trapTab(event)

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)

    top.remove()
  })

  it('does not steal Tab between controls inside the screen', () => {
    const top = document.createElement('div')
    top.setAttribute(SCREEN_ATTR, '')
    const first = document.createElement('button')
    const last = document.createElement('button')
    top.append(first, last)
    document.body.append(top)
    for (const el of [top, first, last]) placeInViewport(el)

    first.focus()
    const event = tabEvent()
    trapTab(event)

    expect(event.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(first)

    top.remove()
  })

  it('ignores inert screens underneath the top overlay', () => {
    const behind = document.createElement('div')
    const top = document.createElement('div')
    behind.setAttribute(SCREEN_ATTR, '')
    top.setAttribute(SCREEN_ATTR, '')
    behind.inert = true

    const prev = document.createElement('button')
    const first = document.createElement('button')
    const last = document.createElement('button')
    behind.append(prev)
    top.append(first, last)
    document.body.append(behind, top)
    for (const el of [behind, top, prev, first, last]) placeInViewport(el)

    first.focus()
    const event = tabEvent(true)
    trapTab(event)

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)

    behind.remove()
    top.remove()
  })
})

describe('getTabbables', () => {
  it('includes a file-picker button and skips hidden inputs and the backdrop', () => {
    const root = document.createElement('div')
    const backdrop = document.createElement('button')
    backdrop.tabIndex = -1
    const pick = document.createElement('button')
    pick.textContent = 'Choose JSON'
    const hidden = document.createElement('input')
    hidden.type = 'file'
    hidden.hidden = true
    const close = document.createElement('button')
    close.textContent = 'Close'
    root.append(backdrop, pick, hidden, close)
    document.body.append(root)
    for (const el of [root, backdrop, pick, close]) placeInViewport(el)

    expect(getTabbables(root).map(el => el.textContent)).toEqual([
      'Choose JSON',
      'Close'
    ])

    root.remove()
  })
})
