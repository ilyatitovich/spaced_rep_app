import { describe, expect, it } from 'vitest'

import { safeAuthReturnTo } from '@/lib/auth-storage'

describe('safeAuthReturnTo', () => {
  it('allows same-origin relative paths and rejects open redirects', () => {
    expect(safeAuthReturnTo('/?settings=true')).toBe('/?settings=true')
    expect(safeAuthReturnTo(undefined)).toBe('/')
    expect(safeAuthReturnTo('https://evil.example/')).toBe('/')
    expect(safeAuthReturnTo('//evil.example')).toBe('/')
  })
})
