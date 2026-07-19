import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { shouldApplyIncoming } from './mappers.js'

describe('shouldApplyIncoming LWW', () => {
  it('applies when local is missing', () => {
    assert.equal(
      shouldApplyIncoming(undefined, undefined, undefined, 100, 'd1', 'r1'),
      true
    )
  })

  it('applies when incoming is newer', () => {
    assert.equal(
      shouldApplyIncoming(100, 'd1', 'r1', 200, 'd2', 'r1'),
      true
    )
  })

  it('rejects when incoming is older', () => {
    assert.equal(
      shouldApplyIncoming(200, 'd1', 'r1', 100, 'd2', 'r1'),
      false
    )
  })

  it('tie-breaks by deviceId then recordId', () => {
    assert.equal(
      shouldApplyIncoming(100, 'aaa', 'r1', 100, 'bbb', 'r1'),
      true
    )
    assert.equal(
      shouldApplyIncoming(100, 'bbb', 'r1', 100, 'aaa', 'r1'),
      false
    )
  })
})
