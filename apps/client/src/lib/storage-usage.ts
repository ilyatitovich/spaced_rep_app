import { getMediaCacheStats } from '@/lib/cache-remote-image'
import { STORES, withTransaction } from '@/lib/db'

export type StorageUsage = {
  usage: number
  quota: number
  estimateAvailable: boolean
  topicCount: number
  cardCount: number
  cardMediaBytes: number
  cardImageCount: number
  cardAudioCount: number
  cacheBytes: number
  cacheCount: number
}

export type EmbeddedCardMedia = {
  bytes: number
  images: number
  audio: number
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Sum embedded image/audio buffers on a card (skips remote `{ src }` images). */
export function sumEmbeddedCardMedia(card: {
  data?: {
    front?: { blocks?: unknown[] }
    back?: { blocks?: unknown[] }
  }
}): EmbeddedCardMedia {
  let bytes = 0
  let images = 0
  let audio = 0

  for (const side of [card.data?.front, card.data?.back]) {
    for (const block of side?.blocks ?? []) {
      if (!block || typeof block !== 'object') continue
      const { type, content } = block as {
        type?: string
        content?: { buffer?: unknown }
      }
      if (
        (type !== 'image' && type !== 'audio') ||
        !(content?.buffer instanceof ArrayBuffer)
      ) {
        continue
      }
      bytes += content.buffer.byteLength
      if (type === 'image') images++
      else audio++
    }
  }

  return { bytes, images, audio }
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

async function getCardMediaStats(): Promise<EmbeddedCardMedia> {
  return withTransaction(STORES.CARDS, 'readonly', stores => {
    return new Promise<EmbeddedCardMedia>((resolve, reject) => {
      let bytes = 0
      let images = 0
      let audio = 0
      const request = stores[STORES.CARDS].openCursor()
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) {
          resolve({ bytes, images, audio })
          return
        }
        const media = sumEmbeddedCardMedia(cursor.value as {
          data?: {
            front?: { blocks?: unknown[] }
            back?: { blocks?: unknown[] }
          }
        })
        bytes += media.bytes
        images += media.images
        audio += media.audio
        cursor.continue()
      }
      request.onerror = () => reject(request.error)
    })
  })
}

/** Origin storage estimate + IDB counts + card media + media_cache size. */
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

  const [{ topicCount, cardCount }, cardMedia, cache] = await Promise.all([
    countTopicsAndCards(),
    getCardMediaStats(),
    getMediaCacheStats()
  ])

  return {
    usage,
    quota,
    estimateAvailable,
    topicCount,
    cardCount,
    cardMediaBytes: cardMedia.bytes,
    cardImageCount: cardMedia.images,
    cardAudioCount: cardMedia.audio,
    cacheBytes: cache.bytes,
    cacheCount: cache.count
  }
}
