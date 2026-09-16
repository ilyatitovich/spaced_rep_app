import { describe, expect, it, vi } from 'vitest'

import {
  BACK_BUTTON_ATTR,
  clickBackButton,
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
})

describe('clickBackButton', () => {
  it('clicks the topmost in-viewport back button', () => {
    const behind = document.createElement('button')
    const top = document.createElement('button')
    behind.setAttribute(BACK_BUTTON_ATTR, '')
    top.setAttribute(BACK_BUTTON_ATTR, '')
    placeInViewport(behind)
    placeInViewport(top)
    document.body.append(behind, top)

    const clicks: string[] = []
    behind.addEventListener('click', () => clicks.push('behind'))
    top.addEventListener('click', () => clicks.push('top'))

    clickBackButton()

    expect(clicks).toEqual(['top'])
    behind.remove()
    top.remove()
  })

  it('skips off-screen back buttons from closed screens', () => {
    const closed = document.createElement('button')
    const open = document.createElement('button')
    closed.setAttribute(BACK_BUTTON_ATTR, '')
    open.setAttribute(BACK_BUTTON_ATTR, '')
    placeInViewport(closed, 2000)
    placeInViewport(open)
    document.body.append(closed, open)

    const onClosed = vi.fn()
    const onOpen = vi.fn()
    closed.addEventListener('click', onClosed)
    open.addEventListener('click', onOpen)

    clickBackButton()

    expect(onClosed).not.toHaveBeenCalled()
    expect(onOpen).toHaveBeenCalledOnce()
    closed.remove()
    open.remove()
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
