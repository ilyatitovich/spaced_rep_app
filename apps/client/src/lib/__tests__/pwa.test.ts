import { afterEach, describe, expect, it, vi } from 'vitest'

import { canFocusForKeyboard, runInTapFocus } from '../pwa'

describe('canFocusForKeyboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('allows focus when not iOS', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0', maxTouchPoints: 0 })
    expect(canFocusForKeyboard()).toBe(true)
  })

  it('allows iOS focus only inside runInTapFocus', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      maxTouchPoints: 5
    })
    expect(canFocusForKeyboard()).toBe(false)
    runInTapFocus(() => {
      expect(canFocusForKeyboard()).toBe(true)
    })
    expect(canFocusForKeyboard()).toBe(false)
  })
})
