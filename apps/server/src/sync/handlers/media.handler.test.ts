import { beforeEach, describe, expect, it, vi } from 'vitest'

const assertPlan = vi.fn()
const enforceRateLimit = vi.fn()
const planMediaUploads = vi.fn()
const planMediaDownloads = vi.fn()

vi.mock('../../settings/services/plan.service.js', () => ({ assertPlan }))
vi.mock('../../shared/lib/redis.js', () => ({ enforceRateLimit }))
vi.mock('../media.service.js', async importOriginal => ({
  ...(await importOriginal<object>()),
  planMediaUploads,
  planMediaDownloads,
  MAX_MEDIA_ITEMS: 100
}))

const { mediaDownloadsHandler, mediaUploadsHandler } = await import(
  './media.handler.js'
)

describe('media HTTP handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assertPlan.mockResolvedValue(undefined)
    enforceRateLimit.mockResolvedValue(undefined)
  })

  it('requires Pro and rate-limits uploads before planning', async () => {
    planMediaUploads.mockResolvedValueOnce([])
    const res = { status: vi.fn(), json: vi.fn() }
    res.status.mockReturnValue(res)

    await mediaUploadsHandler(
      {
        auth: { userId: 'user-1' },
        body: { items: [] }
      } as never,
      res as never,
      vi.fn()
    )

    expect(assertPlan).toHaveBeenCalledWith('user-1', 'PRO')
    expect(enforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'sync:media:uploads:user-1' })
    )
    expect(planMediaUploads).toHaveBeenCalledWith({
      userId: 'user-1',
      items: []
    })
    expect(res.json).toHaveBeenCalledWith({ data: { items: [] } })
  })

  it('requires Pro and rate-limits downloads before planning', async () => {
    planMediaDownloads.mockResolvedValueOnce([])
    const res = { status: vi.fn(), json: vi.fn() }
    res.status.mockReturnValue(res)

    await mediaDownloadsHandler(
      {
        auth: { userId: 'user-1' },
        body: { hashes: [] }
      } as never,
      res as never,
      vi.fn()
    )

    expect(assertPlan).toHaveBeenCalledWith('user-1', 'PRO')
    expect(enforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'sync:media:downloads:user-1' })
    )
    expect(planMediaDownloads).toHaveBeenCalledWith({
      userId: 'user-1',
      hashes: []
    })
  })

  it('blocks uploads when plan check fails', async () => {
    const error = Object.assign(new Error('Pro required'), {
      code: 'PLAN_REQUIRED'
    })
    assertPlan.mockRejectedValueOnce(error)
    const next = vi.fn()

    await mediaUploadsHandler(
      { auth: { userId: 'user-1' }, body: { items: [] } } as never,
      {} as never,
      next
    )

    expect(next).toHaveBeenCalledWith(error)
    expect(planMediaUploads).not.toHaveBeenCalled()
  })
})
