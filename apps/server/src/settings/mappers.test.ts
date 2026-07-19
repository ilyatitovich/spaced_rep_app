import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shouldApplySettingsLww } from './mappers.js'

describe('shouldApplySettingsLww', () => {
  it('applies when existing is missing', () => {
    assert.equal(shouldApplySettingsLww(undefined, undefined, 100, 'd1'), true)
  })

  it('applies when incoming is newer', () => {
    assert.equal(shouldApplySettingsLww(100, 'd1', 200, 'd2'), true)
  })

  it('rejects when incoming is older', () => {
    assert.equal(shouldApplySettingsLww(200, 'd1', 100, 'd2'), false)
  })

  it('tie-breaks by deviceId', () => {
    assert.equal(shouldApplySettingsLww(100, 'aaa', 100, 'bbb'), true)
    assert.equal(shouldApplySettingsLww(100, 'bbb', 100, 'aaa'), false)
  })
})
