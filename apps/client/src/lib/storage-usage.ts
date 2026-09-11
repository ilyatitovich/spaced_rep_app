import { getMediaCacheStats } from '@/lib/cache-remote-image'
import { STORES, withTransaction } from '@/lib/db'

export type StorageUsage = {
  usage: number
  quota: number
  estimateAvailable: boolean
  topicCount: number
  cardCount: number
  cacheBytes: number
  cacheCount: number
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function countTopicsAndCards(): Promise<{
  topicCount: number
  cardCount: number
}> {
  return withTransaction(
    [STORES.TOPICS, STORES.CARDS],
    'readonly',
    async stores => {
      const [topicCount, cardCount] = await Promise.all([
        promisifyRequest(stores[STORES.TOPICS].count()),
        promisifyRequest(stores[STORES.CARDS].count())
      ])
      return { topicCount, cardCount }
    }
  )
}

/** Origin storage estimate + cheap IDB counts + media_cache size. */
export async function getStorageUsage(): Promise<StorageUsage> {
  let usage = 0
  let quota = 0
  let estimateAvailable = false

  try {
    const estimate = await navigator.storage?.estimate?.()
    if (estimate) {
      usage = estimate.usage ?? 0
      quota = estimate.quota ?? 0
      estimateAvailable = true
    }
  } catch {
    // Private mode / blocked storage — leave estimateAvailable false
  }

  const [{ topicCount, cardCount }, cache] = await Promise.all([
    countTopicsAndCards(),
    getMediaCacheStats()
  ])

  return {
    usage,
    quota,
    estimateAvailable,
    topicCount,
    cardCount,
    cacheBytes: cache.bytes,
    cacheCount: cache.count
  }
}
