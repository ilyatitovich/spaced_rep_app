import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  cacheRemoteImage,
  clearMediaCache,
  getMediaCacheStats,
  toHttpsImageUrl,
  type MediaCacheRecord
} from '@/lib/cache-remote-image'

function pngBytes(): ArrayBuffer {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer
}

function memoryStore() {
  const map = new Map<string, MediaCacheRecord>()
  return {
    getCached: async (url: string) => map.get(url),
    putCached: async (record: MediaCacheRecord) => {
      map.set(record.url, record)
    },
    getAll: async () => [...map.values()],
    clear: async () => {
      map.clear()
    },
    map
  }
}

describe('toHttpsImageUrl', () => {
  it('rewrites http and protocol-relative to https', () => {
    expect(toHttpsImageUrl('http://i.imgur.com/a.png')).toBe(
      'https://i.imgur.com/a.png'
    )
    expect(toHttpsImageUrl('//cdn.example/b.webp')).toBe(
      'https://cdn.example/b.webp'
    )
    expect(toHttpsImageUrl('https://cdn.example/c.jpg')).toBe(
      'https://cdn.example/c.jpg'
    )
  })
})

describe('cacheRemoteImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('stores bytes on IDB miss + fetch, and does not fetch again', async () => {
    const store = memoryStore()
    const fetchMock = vi.fn(async () =>
      new Response(pngBytes(), {
        status: 200,
        headers: { 'content-type': 'image/png' }
      })
    )

    const first = await cacheRemoteImage('http://i.imgur.com/a.png', {
      fetch: fetchMock,
      isOnline: () => true,
      getCached: store.getCached,
      putCached: store.putCached
    })

    expect(first?.url).toBe('https://i.imgur.com/a.png')
    expect(first?.type).toBe('image/png')
    expect(new Uint8Array(first!.buffer)).toEqual(new Uint8Array(pngBytes()))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('https://i.imgur.com/a.png')
    expect(store.map.get('https://i.imgur.com/a.png')?.type).toBe('image/png')

    const second = await cacheRemoteImage('http://i.imgur.com/a.png', {
      fetch: fetchMock,
      isOnline: () => true,
      getCached: store.getCached,
      putCached: store.putCached
    })

    expect(second?.url).toBe('https://i.imgur.com/a.png')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns null on offline miss without fetching', async () => {
    const store = memoryStore()
    const fetchMock = vi.fn()

    const result = await cacheRemoteImage('https://cdn.example/x.png', {
      fetch: fetchMock,
      isOnline: () => false,
      getCached: store.getCached,
      putCached: store.putCached
    })

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(store.map.size).toBe(0)
  })

  it('dedupes concurrent fetches for the same URL', async () => {
    const store = memoryStore()
    let resolveFetch!: (value: Response) => void
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>(resolve => {
          resolveFetch = resolve
        })
    )

    const a = cacheRemoteImage('https://cdn.example/same.png', {
      fetch: fetchMock,
      isOnline: () => true,
      getCached: store.getCached,
      putCached: store.putCached
    })
    const b = cacheRemoteImage('https://cdn.example/same.png', {
      fetch: fetchMock,
      isOnline: () => true,
      getCached: store.getCached,
      putCached: store.putCached
    })

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    resolveFetch(
      new Response(pngBytes(), {
        status: 200,
        headers: { 'content-type': 'image/png' }
      })
    )

    const [ra, rb] = await Promise.all([a, b])
    expect(ra?.buffer.byteLength).toBe(4)
    expect(rb?.buffer.byteLength).toBe(4)
    expect(store.map.size).toBe(1)
  })
})

describe('getMediaCacheStats / clearMediaCache', () => {
  it('sums buffer bytes and counts entries', async () => {
    const store = memoryStore()
    await store.putCached({
      url: 'https://a.example/1.png',
      buffer: new ArrayBuffer(100),
      type: 'image/png'
    })
    await store.putCached({
      url: 'https://a.example/2.png',
      buffer: new ArrayBuffer(50),
      type: 'image/png'
    })

    await expect(getMediaCacheStats(store.getAll)).resolves.toEqual({
      bytes: 150,
      count: 2
    })
  })

  it('returns zeros for empty cache and clears all entries', async () => {
    const store = memoryStore()
    await expect(getMediaCacheStats(store.getAll)).resolves.toEqual({
      bytes: 0,
      count: 0
    })

    await store.putCached({
      url: 'https://a.example/1.png',
      buffer: new ArrayBuffer(10),
      type: 'image/png'
    })
    await clearMediaCache(store.clear)
    expect(store.map.size).toBe(0)
    await expect(getMediaCacheStats(store.getAll)).resolves.toEqual({
      bytes: 0,
      count: 0
    })
  })
})
