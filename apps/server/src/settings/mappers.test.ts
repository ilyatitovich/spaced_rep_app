import { shouldApplySettingsLww } from './mappers.js'

describe('shouldApplySettingsLww', () => {
  it('applies when existing is missing', () => {
    expect(shouldApplySettingsLww(undefined, undefined, 100, 'd1')).toBe(true)
  })

  it('applies when incoming is newer', () => {
    expect(shouldApplySettingsLww(100, 'd1', 200, 'd2')).toBe(true)
  })

  it('rejects when incoming is older', () => {
    expect(shouldApplySettingsLww(200, 'd1', 100, 'd2')).toBe(false)
  })

  it('tie-breaks by deviceId', () => {
    expect(shouldApplySettingsLww(100, 'aaa', 100, 'bbb')).toBe(true)
    expect(shouldApplySettingsLww(100, 'bbb', 100, 'aaa')).toBe(false)
  })
})
