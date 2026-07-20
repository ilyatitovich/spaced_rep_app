import { isPlanEntitled } from './plan.service.js'

describe('isPlanEntitled', () => {
  it('allows free for free minimum', () => {
    expect(isPlanEntitled('FREE', 'ACTIVE', 'FREE')).toBe(true)
  })

  it('blocks free from pro', () => {
    expect(isPlanEntitled('FREE', 'ACTIVE', 'PRO')).toBe(false)
  })

  it('allows pro_plus for pro', () => {
    expect(isPlanEntitled('PRO_PLUS', 'ACTIVE', 'PRO')).toBe(true)
  })

  it('rejects past_due even on pro', () => {
    expect(isPlanEntitled('PRO', 'PAST_DUE', 'PRO')).toBe(false)
  })

  it('allows trialing', () => {
    expect(isPlanEntitled('PRO', 'TRIALING', 'PRO')).toBe(true)
  })
})
