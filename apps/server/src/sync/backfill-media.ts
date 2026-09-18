import { createHash } from 'node:crypto'
import { isWireMediaRef } from '@spaced-rep/sync-protocol'
import type { Prisma } from '../generated/prisma/client.js'
import {
  sha256HexToBase64,
  type R2Storage
} from '../shared/lib/r2-storage.js'

type MediaBytes = { bytes: Uint8Array; type: string }

export type BackfillStats = {
  scanned: number
  rewritten: number
  skipped: number
  uploaded: number
  errors: Array<{ cardId: string; error: string }>
}

export type BackfillCardRow = {
  id: string
  userId: string
  data: unknown
}

/** Minimal Prisma surface used by the backfill runner (injectable for tests). */
export type BackfillPrisma = {
  card: {
    findMany: (args: {
      where?: { userId?: string; id?: { gt: string } }
      orderBy: { id: 'asc' }
      take: number
      select: { id: true; userId: true; data: true }
    }) => Promise<BackfillCardRow[]>
    update: (args: {
      where: { id: string }
      data: { data: Prisma.InputJsonValue }
    }) => Promise<unknown>
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRemoteSrc(value: unknown): boolean {
  return isObject(value) && typeof value.src === 'string' && !('buffer' in value)
}

/** Postgres / JSON wire shape before v3: `{ buffer: base64, type }`. */
export function isBase64Media(
  value: unknown
): value is { buffer: string; type: string } {
  return (
    isObject(value) &&
    typeof value.buffer === 'string' &&
    typeof value.type === 'string'
  )
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function mapSide(
  side: unknown,
  mapMedia: (content: unknown) => unknown
): unknown {
  if (!isObject(side)) return side

  if (Array.isArray(side.blocks)) {
    return {
      ...side,
      blocks: side.blocks.map(block => {
        if (!isObject(block)) return block
        if (block.type !== 'image' && block.type !== 'audio') return block
        return { ...block, content: mapMedia(block.content) }
      })
    }
  }

  if (
    isObject(side.content) &&
    ('buffer' in side.content ||
      'hash' in side.content ||
      'src' in side.content)
  ) {
    return { ...side, content: mapMedia(side.content) }
  }

  return side
}

/**
 * Replace base64 `{ buffer, type }` with wire refs. `{ src }` and existing refs
 * pass through. Collects unique bytes by hash for upload.
 */
export function rewriteBase64MediaToRefs(data: unknown): {
  wireData: unknown
  mediaByHash: Map<string, MediaBytes>
  changed: boolean
} {
  const mediaByHash = new Map<string, MediaBytes>()
  let changed = false

  const mapMedia = (content: unknown): unknown => {
    if (isRemoteSrc(content) || isWireMediaRef(content)) return content
    if (!isBase64Media(content)) return content

    changed = true
    const bytes = new Uint8Array(Buffer.from(content.buffer, 'base64'))
    const hash = sha256Hex(bytes)
    mediaByHash.set(hash, { bytes, type: content.type })
    return {
      hash,
      type: content.type,
      byteLength: bytes.byteLength
    }
  }

  if (!isObject(data)) {
    return { wireData: data, mediaByHash, changed: false }
  }

  const wireData = {
    ...data,
    front: mapSide(data.front, mapMedia),
    back: mapSide(data.back, mapMedia)
  }

  return { wireData, mediaByHash, changed }
}

function headMatches(
  head: {
    contentLength: number | undefined
    contentType: string | undefined
    checksumSHA256: string | undefined
  },
  media: MediaBytes,
  hash: string
): boolean {
  const checksum = sha256HexToBase64(hash)
  return (
    head.contentLength === media.bytes.byteLength &&
    head.contentType === media.type &&
    head.checksumSHA256 === checksum
  )
}

/** Upload missing/mismatched objects. Idempotent when HeadObject metadata matches. */
export async function ensureMediaObjects(input: {
  storage: R2Storage
  userId: string
  mediaByHash: Map<string, MediaBytes>
  /** Keys already confirmed this run (`userId/hash`). */
  confirmedKeys?: Set<string>
}): Promise<number> {
  const confirmed = input.confirmedKeys ?? new Set<string>()
  let uploaded = 0

  for (const [hash, media] of input.mediaByHash) {
    const key = input.storage.objectKey(input.userId, hash)
    if (confirmed.has(key)) continue

    const head = await input.storage.headObject(key)
    if (head && headMatches(head, media, hash)) {
      confirmed.add(key)
      continue
    }

    await input.storage.putObject({
      key,
      body: media.bytes,
      contentType: media.type,
      checksumSHA256Hex: hash
    })
    confirmed.add(key)
    uploaded += 1
  }

  return uploaded
}

/**
 * Backfill one card: upload media, then rewrite JSON to refs.
 * Does not touch `updatedAt` (representation-only; LWW-safe).
 */
export async function backfillOneCard(input: {
  prisma: BackfillPrisma
  storage: R2Storage
  card: BackfillCardRow
  dryRun?: boolean
  confirmedKeys?: Set<string>
}): Promise<{
  status: 'rewritten' | 'skipped'
  uploaded: number
}> {
  const { wireData, mediaByHash, changed } = rewriteBase64MediaToRefs(
    input.card.data
  )
  if (!changed) return { status: 'skipped', uploaded: 0 }

  if (input.dryRun) {
    return { status: 'rewritten', uploaded: mediaByHash.size }
  }

  const uploaded = await ensureMediaObjects({
    storage: input.storage,
    userId: input.card.userId,
    mediaByHash,
    confirmedKeys: input.confirmedKeys
  })

  await input.prisma.card.update({
    where: { id: input.card.id },
    data: { data: wireData as Prisma.InputJsonValue }
  })

  return { status: 'rewritten', uploaded }
}

export async function runMediaBackfill(input: {
  prisma: BackfillPrisma
  storage: R2Storage
  dryRun?: boolean
  userId?: string
  batchSize?: number
  onProgress?: (stats: BackfillStats) => void
}): Promise<BackfillStats> {
  const batchSize = input.batchSize ?? 100
  const stats: BackfillStats = {
    scanned: 0,
    rewritten: 0,
    skipped: 0,
    uploaded: 0,
    errors: []
  }
  const confirmedKeys = new Set<string>()
  let cursor: string | undefined

  for (;;) {
    const batch = await input.prisma.card.findMany({
      where: {
        ...(input.userId ? { userId: input.userId } : {}),
        ...(cursor ? { id: { gt: cursor } } : {})
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      select: { id: true, userId: true, data: true }
    })
    if (batch.length === 0) break

    for (const card of batch) {
      stats.scanned += 1
      try {
        const result = await backfillOneCard({
          prisma: input.prisma,
          storage: input.storage,
          card,
          dryRun: input.dryRun,
          confirmedKeys
        })
        if (result.status === 'skipped') stats.skipped += 1
        else {
          stats.rewritten += 1
          stats.uploaded += result.uploaded
        }
      } catch (err) {
        stats.errors.push({
          cardId: card.id,
          error: err instanceof Error ? err.message : String(err)
        })
      }
      input.onProgress?.(stats)
    }

    cursor = batch[batch.length - 1]!.id
    if (batch.length < batchSize) break
  }

  return stats
}
