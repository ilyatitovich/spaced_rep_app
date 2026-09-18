import {
  collectWireMediaRefs,
  fromWireCardData,
  prepareWireCardData,
  sha256Hex,
  type MediaDBRecord,
  type PullDelta,
  type WireMediaRef
} from '@spaced-rep/sync-protocol'

/** Matches server `MAX_MEDIA_ITEMS`. */
export const MEDIA_REQUEST_BATCH = 100
const DOWNLOAD_CONCURRENCY = 4

export type MediaUploadPlanItem =
  | { hash: string; exists: true }
  | {
      hash: string
      exists: false
      url: string
      headers: {
        'content-type': string
        'x-amz-checksum-sha256': string
      }
    }

export type MediaDownloadPlanItem = {
  hash: string
  url: string
  type: string
  byteLength: number
}

export type SyncMediaApi = {
  planUploads(
    items: {
      hash: string
      type: string
      byteLength: number
      checksum: string
    }[]
  ): Promise<MediaUploadPlanItem[]>
  planDownloads(hashes: string[]): Promise<MediaDownloadPlanItem[]>
}

/** Lowercase hex SHA-256 → base64 digest for `x-amz-checksum-sha256`. */
export function sha256HexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const results: R[] = []
  let next = 0

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index]!)
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  )
  await Promise.all(workers)
  return results
}

function isOpaqueForbidden(response: Response): boolean {
  return response.status === 403
}

async function putObjectOnce(
  url: string,
  body: ArrayBuffer,
  headers: Record<string, string>
): Promise<Response> {
  return fetch(url, { method: 'PUT', headers, body })
}

async function getObjectOnce(url: string): Promise<Response> {
  return fetch(url, { method: 'GET' })
}

/** Upload missing owned media before pushBatch. Leaves queue alone on failure. */
export async function uploadOwnedMedia(
  mediaByHash: ReadonlyMap<string, MediaDBRecord>,
  api: SyncMediaApi
): Promise<void> {
  if (mediaByHash.size === 0) return

  const items = [...mediaByHash.entries()].map(([hash, media]) => ({
    hash,
    type: media.type,
    byteLength: media.buffer.byteLength,
    checksum: sha256HexToBase64(hash)
  }))

  const plans: MediaUploadPlanItem[] = []
  for (const batch of chunk(items, MEDIA_REQUEST_BATCH)) {
    plans.push(...(await api.planUploads(batch)))
  }

  const byHash = new Map(plans.map(item => [item.hash, item]))

  for (const [hash, media] of mediaByHash) {
    const plan = byHash.get(hash)
    if (!plan) {
      throw new Error(`No upload plan for media hash ${hash}`)
    }
    if (plan.exists) continue

    let response = await putObjectOnce(plan.url, media.buffer, plan.headers)
    if (isOpaqueForbidden(response)) {
      const [fresh] = await api.planUploads([
        {
          hash,
          type: media.type,
          byteLength: media.buffer.byteLength,
          checksum: sha256HexToBase64(hash)
        }
      ])
      if (!fresh || fresh.exists) {
        throw new Error(`Media upload retry failed for hash ${hash}`)
      }
      response = await putObjectOnce(fresh.url, media.buffer, fresh.headers)
    }

    if (!response.ok) {
      throw new Error(
        `Media upload failed for hash ${hash}: ${response.status}`
      )
    }
  }
}

async function downloadVerified(
  item: MediaDownloadPlanItem,
  refresh: () => Promise<MediaDownloadPlanItem>
): Promise<ArrayBuffer> {
  let plan = item
  let response = await getObjectOnce(plan.url)
  if (isOpaqueForbidden(response)) {
    plan = await refresh()
    response = await getObjectOnce(plan.url)
  }

  if (!response.ok) {
    throw new Error(
      `Media download failed for hash ${plan.hash}: ${response.status}`
    )
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength !== plan.byteLength) {
    throw new Error(
      `Media size mismatch for hash ${plan.hash}: expected ${plan.byteLength}, got ${buffer.byteLength}`
    )
  }

  const digest = await sha256Hex(buffer)
  if (digest !== plan.hash) {
    throw new Error(`Media integrity check failed for hash ${plan.hash}`)
  }

  return buffer
}

/** Download and verify bytes for wire refs. Throws if any hash is missing or bad. */
export async function downloadMediaByHash(
  refs: readonly WireMediaRef[],
  api: SyncMediaApi
): Promise<Map<string, ArrayBuffer>> {
  if (refs.length === 0) return new Map()

  const unique = new Map(refs.map(ref => [ref.hash, ref]))
  const hashes = [...unique.keys()]
  const plans: MediaDownloadPlanItem[] = []
  for (const batch of chunk(hashes, MEDIA_REQUEST_BATCH)) {
    plans.push(...(await api.planDownloads(batch)))
  }

  const planByHash = new Map(plans.map(item => [item.hash, item]))
  for (const hash of hashes) {
    if (!planByHash.has(hash)) {
      throw new Error(`Media object not found: ${hash}`)
    }
  }

  const downloaded = await mapPool(plans, DOWNLOAD_CONCURRENCY, item =>
    downloadVerified(item, async () => {
      const [fresh] = await api.planDownloads([item.hash])
      if (!fresh) throw new Error(`Media object not found: ${item.hash}`)
      return fresh
    })
  )

  const bytesByHash = new Map<string, ArrayBuffer>()
  for (let i = 0; i < plans.length; i++) {
    bytesByHash.set(plans[i]!.hash, downloaded[i]!)
  }
  return bytesByHash
}

export function mergePreparedMedia(
  into: Map<string, MediaDBRecord>,
  from: ReadonlyMap<string, MediaDBRecord>
): void {
  for (const [hash, media] of from) {
    into.set(hash, media)
  }
}

export { prepareWireCardData }

/**
 * Resolve card `dataJson` wire refs into local `{ buffer, type }` objects.
 * Returns a map of cardId → hydrated data (ArrayBuffers intact — do not JSON.stringify).
 * Throws before returning if any download/verify fails so callers skip persistence + watermark.
 */
export async function hydrateIncomingCardData(
  delta: PullDelta,
  api: SyncMediaApi
): Promise<Map<string, unknown>> {
  const parsedByCardId = new Map<string, unknown>()
  const refs: WireMediaRef[] = []

  for (const record of delta.records) {
    if (!record.card || record.card.deletedAt) continue
    const data = JSON.parse(record.card.dataJson) as unknown
    parsedByCardId.set(record.card.id, data)
    refs.push(...(await collectWireMediaRefs(data)))
  }

  if (refs.length === 0) return parsedByCardId

  const bytesByHash = await downloadMediaByHash(refs, api)
  const hydrated = new Map<string, unknown>()

  for (const [cardId, data] of parsedByCardId) {
    hydrated.set(cardId, await fromWireCardData(data, bytesByHash))
  }

  return hydrated
}
