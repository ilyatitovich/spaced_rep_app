import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isPlanEntitled } from './plan.service.js'

describe('isPlanEntitled', () => {
  it('allows free for free minimum', () => {
    assert.equal(isPlanEntitled('FREE', 'ACTIVE', 'FREE'), true)
  })

  it('blocks free from pro', () => {
    assert.equal(isPlanEntitled('FREE', 'ACTIVE', 'PRO'), false)
  })

  it('allows pro_plus for pro', () => {
    assert.equal(isPlanEntitled('PRO_PLUS', 'ACTIVE', 'PRO'), true)
  })

  it('rejects past_due even on pro', () => {
    assert.equal(isPlanEntitled('PRO', 'PAST_DUE', 'PRO'), false)
  })

  it('allows trialing', () => {
    assert.equal(isPlanEntitled('PRO', 'TRIALING', 'PRO'), true)
  })
})
