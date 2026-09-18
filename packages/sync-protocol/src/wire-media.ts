import { SHA256_HEX, type WireMediaRef } from './schemas.js'

/** Same shape as client `MediaDBRecord`. */
export type MediaDBRecord = { buffer: ArrayBuffer; type: string }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isWireMediaRef(value: unknown): value is WireMediaRef {
  return (
    isObject(value) &&
    typeof value.hash === 'string' &&
    SHA256_HEX.test(value.hash) &&
    typeof value.type === 'string' &&
    typeof value.byteLength === 'number' &&
    Number.isInteger(value.byteLength) &&
    value.byteLength > 0
  )
}

export function isLocalMediaBuffer(value: unknown): value is MediaDBRecord {
  return (
    isObject(value) &&
    value.buffer instanceof ArrayBuffer &&
    typeof value.type === 'string'
  )
}

function isRemoteSrc(value: unknown): boolean {
  return isObject(value) && typeof value.src === 'string' && !('buffer' in value)
}

function isBlocksSide(side: Record<string, unknown>): boolean {
  return Array.isArray(side.blocks)
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

async function mapSide(
  side: unknown,
  mapMedia: (content: unknown) => Promise<unknown>
): Promise<unknown> {
  if (!isObject(side)) return side

  if (isBlocksSide(side)) {
    const blocks = await Promise.all(
      (side.blocks as unknown[]).map(async block => {
        if (!isObject(block)) return block
        if (block.type !== 'image' && block.type !== 'audio') return block
        return { ...block, content: await mapMedia(block.content) }
      })
    )
    return { ...side, blocks }
  }

  if (
    isObject(side.content) &&
    ('buffer' in side.content ||
      'hash' in side.content ||
      'src' in side.content)
  ) {
    return { ...side, content: await mapMedia(side.content) }
  }

  return side
}

async function mapCardMedia(
  data: unknown,
  mapMedia: (content: unknown) => Promise<unknown>
): Promise<unknown> {
  if (!isObject(data)) return data
  return {
    ...data,
    front: await mapSide(data.front, mapMedia),
    back: await mapSide(data.back, mapMedia)
  }
}

/** Replace local `{ buffer, type }` with wire refs. `{ src }` and existing refs pass through. */
export async function toWireCardData(data: unknown): Promise<unknown> {
  const cache = new WeakMap<ArrayBuffer, WireMediaRef>()

  return mapCardMedia(data, async content => {
    if (isRemoteSrc(content) || isWireMediaRef(content)) return content
    if (!isLocalMediaBuffer(content)) return content

    const cached = cache.get(content.buffer)
    if (cached) {
      return { ...cached, type: content.type }
    }

    const hash = await sha256Hex(content.buffer)
    const ref: WireMediaRef = {
      hash,
      type: content.type,
      byteLength: content.buffer.byteLength
    }
    cache.set(content.buffer, ref)
    return ref
  })
}

/** Replace wire refs with local `{ buffer, type }` using downloaded bytes. `{ src }` passes through. */
export async function fromWireCardData(
  data: unknown,
  bytesByHash: ReadonlyMap<string, ArrayBuffer>
): Promise<unknown> {
  return mapCardMedia(data, async content => {
    if (isRemoteSrc(content) || isLocalMediaBuffer(content)) return content
    if (!isWireMediaRef(content)) return content

    const buffer = bytesByHash.get(content.hash)
    if (!buffer) {
      throw new Error(`Missing media bytes for hash ${content.hash}`)
    }
    return { buffer, type: content.type }
  })
}

/** Collect unique wire media refs from card data (blocks + legacy exclusive sides). */
export async function collectWireMediaRefs(
  data: unknown
): Promise<WireMediaRef[]> {
  const byHash = new Map<string, WireMediaRef>()

  await mapCardMedia(data, async content => {
    if (isWireMediaRef(content)) {
      byHash.set(content.hash, content)
    }
    return content
  })

  return [...byHash.values()]
}
