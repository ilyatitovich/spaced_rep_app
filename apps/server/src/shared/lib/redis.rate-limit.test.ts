import { beforeEach, describe, expect, it, vi } from 'vitest'

const evalFn = vi.fn()
const incrFn = vi.fn()
const expireFn = vi.fn()
const setFn = vi.fn()

vi.mock('redis', () => ({
  createClient: () => ({
    isOpen: true,
    connect: vi.fn(),
    on: vi.fn(),
    eval: evalFn,
    incr: incrFn,
    expire: expireFn,
    set: setFn
  })
}))

const { enforceRateLimit, tryAcquireLeaderLock } = await import('./redis.js')
const { TooManyRequestsError } = await import('./errors.js')

describe('enforceRateLimit', () => {
  beforeEach(() => {
    evalFn.mockReset()
    incrFn.mockReset()
    expireFn.mockReset()
    setFn.mockReset()
  })

  it('increments and expires in a single Lua EVAL (not separate INCR+EXPIRE)', async () => {
    evalFn.mockResolvedValue(1)

    await enforceRateLimit({
      key: 'test:rl:atomic',
      limit: 5,
      windowSeconds: 60
    })

    expect(evalFn).toHaveBeenCalledOnce()
    const [script, opts] = evalFn.mock.calls[0]!
    expect(String(script)).toMatch(/INCR/i)
    expect(String(script)).toMatch(/EXPIRE/i)
    expect(opts).toEqual({
      keys: ['test:rl:atomic'],
      arguments: ['60']
    })
    expect(incrFn).not.toHaveBeenCalled()
    expect(expireFn).not.toHaveBeenCalled()
  })

  it('rejects when the counter exceeds the limit', async () => {
    evalFn.mockResolvedValue(3)

    await expect(
      enforceRateLimit({
        key: 'test:rl:limit',
        limit: 2,
        windowSeconds: 60
      })
    ).rejects.toBeInstanceOf(TooManyRequestsError)
  })

  it('fails closed when Redis EVAL errors', async () => {
    evalFn.mockRejectedValue(new Error('redis down'))

    await expect(
      enforceRateLimit({
        key: 'test:rl:down',
        limit: 2,
        windowSeconds: 60
      })
    ).rejects.toBeInstanceOf(TooManyRequestsError)
  })
})

describe('tryAcquireLeaderLock', () => {
  beforeEach(() => {
    setFn.mockReset()
  })

  it('returns true when SET NX succeeds', async () => {
    setFn.mockResolvedValue('OK')
    await expect(tryAcquireLeaderLock('leader:reminder', 90)).resolves.toBe(
      true
    )
    expect(setFn).toHaveBeenCalledWith('leader:reminder', '1', {
      NX: true,
      EX: 90
    })
  })

  it('returns false when another replica holds the lock', async () => {
    setFn.mockResolvedValue(null)
    await expect(tryAcquireLeaderLock('leader:reminder', 90)).resolves.toBe(
      false
    )
  })

  it('returns false when Redis errors', async () => {
    setFn.mockRejectedValue(new Error('redis down'))
    await expect(tryAcquireLeaderLock('leader:billing', 100)).resolves.toBe(
      false
    )
  })
})
