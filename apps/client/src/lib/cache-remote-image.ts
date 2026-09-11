import { STORES, withTransaction } from '@/lib/db'
import type { MediaDBRecord } from '@/types'

const MAX_REMOTE_IMAGE_BYTES = 5 * 1024 * 1024

export type MediaCacheRecord = MediaDBRecord & { url: string }

type CacheRemoteImageOptions = {
  fetch?: typeof globalThis.fetch
  isOnline?: () => boolean
  getCached?: (url: string) => Promise<MediaCacheRecord | undefined>
  putCached?: (record: MediaCacheRecord) => Promise<void>
}

const inflight = new Map<string, Promise<MediaCacheRecord | null>>()

/** Rewrite http / protocol-relative URLs so a HTTPS PWA is not blocked by mixed content. */
export function toHttpsImageUrl(src: string): string {
  if (src.startsWith('//')) return `https:${src}`
  if (src.startsWith('http://')) return `https://${src.slice('http://'.length)}`
  return src
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getCachedDefault(
  url: string
): Promise<MediaCacheRecord | undefined> {
  return withTransaction(STORES.MEDIA_CACHE, 'readonly', stores =>
    promisifyRequest(
      stores[STORES.MEDIA_CACHE].get(url) as IDBRequest<
        MediaCacheRecord | undefined
      >
    )
  )
}

async function putCachedDefault(record: MediaCacheRecord): Promise<void> {
  await withTransaction(STORES.MEDIA_CACHE, 'readwrite', async stores => {
    await promisifyRequest(stores[STORES.MEDIA_CACHE].put(record))
  })
}

async function getAllCachedDefault(): Promise<MediaCacheRecord[]> {
  return withTransaction(STORES.MEDIA_CACHE, 'readonly', stores =>
    promisifyRequest(
      stores[STORES.MEDIA_CACHE].getAll() as IDBRequest<MediaCacheRecord[]>
    )
  )
}

async function clearCachedDefault(): Promise<void> {
  await withTransaction(STORES.MEDIA_CACHE, 'readwrite', async stores => {
    await promisifyRequest(stores[STORES.MEDIA_CACHE].clear())
  })
}

export type MediaCacheStats = { bytes: number; count: number }

/** Sum buffer sizes in media_cache (remote images only). */
export async function getMediaCacheStats(
  getAll: () => Promise<MediaCacheRecord[]> = getAllCachedDefault
): Promise<MediaCacheStats> {
  const records = await getAll()
  let bytes = 0
  for (const record of records) {
    bytes += record.buffer.byteLength
  }
  return { bytes, count: records.length }
}

/** Clear all lazily cached remote images. Does not touch card-embedded media. */
export async function clearMediaCache(
  clear: () => Promise<void> = clearCachedDefault
): Promise<void> {
  await clear()
}

/**
 * Resolve a remote image URL to cached bytes (IDB keyed by https URL).
 * Online miss: fetch once, require image/* and ≤5MB, then store.
 * Offline miss / CORS / bad type / oversize → null (caller can still use img src).
 */
export async function cacheRemoteImage(
  src: string,
  options: CacheRemoteImageOptions = {}
): Promise<MediaCacheRecord | null> {
  const url = toHttpsImageUrl(src)
  const pending = inflight.get(url)
  if (pending) return pending

  const run = cacheRemoteImageOnce(url, options)
  inflight.set(url, run)
  try {
    return await run
  } finally {
    inflight.delete(url)
  }
}

async function cacheRemoteImageOnce(
  url: string,
  options: CacheRemoteImageOptions
): Promise<MediaCacheRecord | null> {
  const getCached = options.getCached ?? getCachedDefault
  const putCached = options.putCached ?? putCachedDefault
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis)
  const isOnline =
    options.isOnline ?? (() => globalThis.navigator?.onLine !== false)

  const hit = await getCached(url)
  if (hit) return hit

  if (!isOnline()) return null

  try {
    const res = await fetchFn(url)
    if (!res.ok) return null

    const rawType = res.headers.get('content-type') ?? ''
    if (!rawType.startsWith('image/')) return null
    const type = rawType.split(';')[0]!.trim()

    const contentLength = Number(res.headers.get('content-length'))
    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_REMOTE_IMAGE_BYTES
    ) {
      return null
    }

    const buffer = await res.arrayBuffer()
    if (buffer.byteLength > MAX_REMOTE_IMAGE_BYTES) return null

    const record: MediaCacheRecord = { url, buffer, type }
    await putCached(record)
    return record
  } catch {
    // CORS and network errors: display can still use <img src>; do not persist.
    return null
  }
}
