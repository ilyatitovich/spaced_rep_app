import { STORES, withTransaction } from '@/lib/db'

export type EmbeddedCardMedia = {
  bytes: number
  images: number
  audio: number
}

const META_KEY = 'cardMediaStats'
const EMPTY: EmbeddedCardMedia = { bytes: 0, images: 0, audio: 0 }

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

export function addEmbeddedMedia(
  a: EmbeddedCardMedia,
  b: EmbeddedCardMedia
): EmbeddedCardMedia {
  return {
    bytes: a.bytes + b.bytes,
    images: a.images + b.images,
    audio: a.audio + b.audio
  }
}

export function subEmbeddedMedia(
  a: EmbeddedCardMedia,
  b: EmbeddedCardMedia
): EmbeddedCardMedia {
  return {
    bytes: a.bytes - b.bytes,
    images: a.images - b.images,
    audio: a.audio - b.audio
  }
}

async function readMeta(): Promise<EmbeddedCardMedia | null> {
  const record = await withTransaction(STORES.SYNC_META, 'readonly', stores =>
    promisifyRequest<{ key: string; value: string } | undefined>(
      stores[STORES.SYNC_META].get(META_KEY)
    )
  )
  if (!record?.value) return null
  try {
    const parsed = JSON.parse(record.value) as Partial<EmbeddedCardMedia>
    if (
      typeof parsed.bytes !== 'number' ||
      typeof parsed.images !== 'number' ||
      typeof parsed.audio !== 'number'
    ) {
      return null
    }
    return {
      bytes: parsed.bytes,
      images: parsed.images,
      audio: parsed.audio
    }
  } catch {
    return null
  }
}

async function writeMeta(stats: EmbeddedCardMedia): Promise<void> {
  const safe: EmbeddedCardMedia = {
    bytes: Math.max(0, stats.bytes),
    images: Math.max(0, stats.images),
    audio: Math.max(0, stats.audio)
  }
  await withTransaction(STORES.SYNC_META, 'readwrite', async stores => {
    await promisifyRequest(
      stores[STORES.SYNC_META].put({
        key: META_KEY,
        value: JSON.stringify(safe)
      })
    )
  })
}

/** Full cursor scan — only for cold start / repair. Avoid on settings open once cached. */
export async function rebuildCardMediaStats(): Promise<EmbeddedCardMedia> {
  const scanned = await withTransaction(STORES.CARDS, 'readonly', stores => {
    return new Promise<EmbeddedCardMedia>((resolve, reject) => {
      let stats = { ...EMPTY }
      const request = stores[STORES.CARDS].openCursor()
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) {
          resolve(stats)
          return
        }
        stats = addEmbeddedMedia(
          stats,
          sumEmbeddedCardMedia(
            cursor.value as {
              data?: {
                front?: { blocks?: unknown[] }
                back?: { blocks?: unknown[] }
              }
            }
          )
        )
        cursor.continue()
      }
      request.onerror = () => reject(request.error)
    })
  })
  await writeMeta(scanned)
  return scanned
}

/** O(1) read when meta is warm; one-time rebuild if missing. */
export async function getCardMediaStats(): Promise<EmbeddedCardMedia> {
  return (await readMeta()) ?? rebuildCardMediaStats()
}

export async function adjustCardMediaStats(
  delta: EmbeddedCardMedia
): Promise<void> {
  if (delta.bytes === 0 && delta.images === 0 && delta.audio === 0) return
  const current = (await readMeta()) ?? (await rebuildCardMediaStats())
  await writeMeta(addEmbeddedMedia(current, delta))
}

/** Apply media delta for a card upsert (create or replace). */
export async function recordCardMediaUpsert(
  previous:
    | {
        data?: {
          front?: { blocks?: unknown[] }
          back?: { blocks?: unknown[] }
        }
      }
    | undefined,
  next: {
    data?: {
      front?: { blocks?: unknown[] }
      back?: { blocks?: unknown[] }
    }
  }
): Promise<void> {
  const before = previous ? sumEmbeddedCardMedia(previous) : EMPTY
  const after = sumEmbeddedCardMedia(next)
  await adjustCardMediaStats(subEmbeddedMedia(after, before))
}

export async function recordCardMediaDelete(previous: {
  data?: {
    front?: { blocks?: unknown[] }
    back?: { blocks?: unknown[] }
  }
}): Promise<void> {
  await adjustCardMediaStats(
    subEmbeddedMedia(EMPTY, sumEmbeddedCardMedia(previous))
  )
}

/** Net-add media for cards known to be new (no prior row), e.g. Anki import. */
export async function recordCardMediaInserted(
  cards: Array<{
    data?: {
      front?: { blocks?: unknown[] }
      back?: { blocks?: unknown[] }
    }
  }>
): Promise<void> {
  let delta = { ...EMPTY }
  for (const card of cards) {
    delta = addEmbeddedMedia(delta, sumEmbeddedCardMedia(card))
  }
  await adjustCardMediaStats(delta)
}
