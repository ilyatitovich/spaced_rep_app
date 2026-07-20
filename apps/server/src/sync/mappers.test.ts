import { shouldApplyIncoming } from './mappers.js'

describe('shouldApplyIncoming LWW', () => {
  it('applies when local is missing', () => {
    expect(
      shouldApplyIncoming(undefined, undefined, undefined, 100, 'd1', 'r1')
    ).toBe(true)
  })

  it('applies when incoming is newer', () => {
    expect(shouldApplyIncoming(100, 'd1', 'r1', 200, 'd2', 'r1')).toBe(true)
  })

  it('rejects when incoming is older', () => {
    expect(shouldApplyIncoming(200, 'd1', 'r1', 100, 'd2', 'r1')).toBe(false)
  })

  it('tie-breaks by deviceId then recordId', () => {
    expect(shouldApplyIncoming(100, 'aaa', 'r1', 100, 'bbb', 'r1')).toBe(true)
    expect(shouldApplyIncoming(100, 'bbb', 'r1', 100, 'aaa', 'r1')).toBe(false)
  })
})
