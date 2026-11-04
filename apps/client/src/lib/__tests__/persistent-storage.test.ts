import { afterEach, describe, expect, it, vi } from 'vitest'

describe('requestPersistentStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('returns true when persist() grants durable storage', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('navigator', { storage: { persist } })

    const { requestPersistentStorage } = await import('../storage-usage')
    await expect(requestPersistentStorage()).resolves.toBe(true)
    expect(persist).toHaveBeenCalledOnce()
  })

  it('returns false when persist() is unavailable or throws', async () => {
    vi.stubGlobal('navigator', { storage: {} })
    const { requestPersistentStorage } = await import('../storage-usage')
    await expect(requestPersistentStorage()).resolves.toBe(false)

    vi.resetModules()
    vi.stubGlobal('navigator', {
      storage: {
        persist: vi.fn().mockRejectedValue(new Error('denied'))
      }
    })
    const again = await import('../storage-usage')
    await expect(again.requestPersistentStorage()).resolves.toBe(false)
  })
})

describe('getStorageUsage persisted flag', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    vi.doUnmock('../db')
    vi.doUnmock('../card-media-stats')
    vi.doUnmock('../cache-remote-image')
  })

  it('reports whether storage is persisted', async () => {
    vi.doMock('../db', () => ({
      STORES: { TOPICS: 'topics', CARDS: 'cards' },
      withTransaction: vi.fn(async () => ({ topicCount: 1, cardCount: 2 }))
    }))
    vi.doMock('../card-media-stats', () => ({
      getCardMediaStats: vi
        .fn()
        .mockResolvedValue({ bytes: 0, images: 0, audio: 0 }),
      sumEmbeddedCardMedia: vi.fn()
    }))
    vi.doMock('../cache-remote-image', () => ({
      getMediaCacheStats: vi.fn().mockResolvedValue({ bytes: 0, count: 0 })
    }))

    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 10, quota: 100 }),
        persisted: vi.fn().mockResolvedValue(true)
      }
    })

    const { getStorageUsage } = await import('../storage-usage')
    const usage = await getStorageUsage()
    expect(usage.persisted).toBe(true)
    expect(usage.estimateAvailable).toBe(true)
    expect(usage.topicCount).toBe(1)
    expect(usage.cardCount).toBe(2)
  })
})
