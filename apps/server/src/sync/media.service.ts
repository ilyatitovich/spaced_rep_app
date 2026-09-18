import {
  collectWireMediaRefs,
  isWireMediaRef,
  SHA256_HEX,
  type Mutation,
  type WireMediaRef
} from '@spaced-rep/sync-protocol'
import { BadRequestError, MediaRefError } from '../shared/lib/errors.js'
import {
  createR2StorageFromEnv,
  sha256HexToBase64,
  type ObjectHead,
  type PresignedPut,
  type R2Storage
} from '../shared/lib/r2-storage.js'

export const MAX_MEDIA_ITEMS = 100
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024

export const ALLOWED_MEDIA_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/mp4'
])

export type MediaUploadItem = {
  hash: string
  type: string
  byteLength: number
  /** Base64 SHA-256 digest; must match `hash`. */
  checksum: string
}

export type MediaUploadResult =
  | { hash: string; exists: true }
  | {
      hash: string
      exists: false
      url: string
      headers: PresignedPut['headers']
    }

export type MediaDownloadResult = {
  hash: string
  url: string
  type: string
  byteLength: number
}

let storageOverride: R2Storage | null = null

/** Test seam — inject a mock R2/S3 store. */
export function setMediaStorageForTests(storage: R2Storage | null): void {
  storageOverride = storage
}

function getStorage(): R2Storage {
  return storageOverride ?? createR2StorageFromEnv()
}

export function maxBytesForMediaType(type: string): number | null {
  if (!ALLOWED_MEDIA_TYPES.has(type)) return null
  return type.startsWith('image/') ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES
}

function assertValidUploadItem(item: MediaUploadItem): void {
  if (!SHA256_HEX.test(item.hash)) {
    throw new BadRequestError(
      'hash must be lowercase SHA-256 hex',
      'MEDIA_INVALID'
    )
  }
  const maxBytes = maxBytesForMediaType(item.type)
  if (maxBytes == null) {
    throw new BadRequestError(
      `Unsupported media type: ${item.type}`,
      'MEDIA_INVALID'
    )
  }
  if (!Number.isInteger(item.byteLength) || item.byteLength <= 0) {
    throw new BadRequestError(
      'byteLength must be a positive integer',
      'MEDIA_INVALID'
    )
  }
  if (item.byteLength > maxBytes) {
    throw new BadRequestError(
      `Media exceeds maximum size for ${item.type}`,
      'MEDIA_TOO_LARGE'
    )
  }
  const expectedChecksum = sha256HexToBase64(item.hash)
  if (item.checksum !== expectedChecksum) {
    throw new BadRequestError(
      'checksum must be the base64 SHA-256 of hash',
      'MEDIA_INVALID'
    )
  }
}

function headMatchesRef(
  head: ObjectHead,
  ref: Pick<WireMediaRef, 'type' | 'byteLength'> & { checksumBase64: string }
): boolean {
  return (
    head.contentLength === ref.byteLength &&
    head.contentType === ref.type &&
    head.checksumSHA256 === ref.checksumBase64
  )
}

function validateWireRefShape(ref: WireMediaRef): MediaRefError | null {
  const maxBytes = maxBytesForMediaType(ref.type)
  if (maxBytes == null) {
    return new MediaRefError(
      'MEDIA_INVALID',
      `Unsupported media type: ${ref.type}`,
      false
    )
  }
  if (ref.byteLength > maxBytes) {
    return new MediaRefError(
      'MEDIA_TOO_LARGE',
      `Media exceeds maximum size for ${ref.type}`,
      false
    )
  }
  return null
}

function mediaErrorFromHead(
  head: ObjectHead | null,
  ref: WireMediaRef
): MediaRefError | null {
  if (!head) {
    return new MediaRefError(
      'MEDIA_NOT_FOUND',
      `Media object not found: ${ref.hash}`,
      true
    )
  }
  const checksumBase64 = sha256HexToBase64(ref.hash)
  if (!headMatchesRef(head, { ...ref, checksumBase64 })) {
    return new MediaRefError(
      'MEDIA_INTEGRITY',
      `Media object metadata mismatch: ${ref.hash}`,
      true
    )
  }
  return null
}

/** Dedupe upload items, HeadObject existing keys, presign PUTs for misses/mismatches. */
export async function planMediaUploads(input: {
  userId: string
  items: MediaUploadItem[]
}): Promise<MediaUploadResult[]> {
  if (input.items.length === 0) return []
  if (input.items.length > MAX_MEDIA_ITEMS) {
    throw new BadRequestError(
      `At most ${MAX_MEDIA_ITEMS} media items per request`,
      'MEDIA_INVALID'
    )
  }

  const byHash = new Map<string, MediaUploadItem>()
  for (const item of input.items) {
    assertValidUploadItem(item)
    const existing = byHash.get(item.hash)
    if (
      existing &&
      (existing.type !== item.type ||
        existing.byteLength !== item.byteLength ||
        existing.checksum !== item.checksum)
    ) {
      throw new BadRequestError(
        `Conflicting metadata for hash ${item.hash}`,
        'MEDIA_INVALID'
      )
    }
    byHash.set(item.hash, item)
  }

  const storage = getStorage()
  const results: MediaUploadResult[] = []

  for (const item of byHash.values()) {
    const key = storage.objectKey(input.userId, item.hash)
    const head = await storage.headObject(key)
    const checksumBase64 = item.checksum
    if (
      head &&
      headMatchesRef(head, {
        type: item.type,
        byteLength: item.byteLength,
        checksumBase64
      })
    ) {
      results.push({ hash: item.hash, exists: true })
      continue
    }

    const put = await storage.presignPut({
      key,
      contentType: item.type,
      checksumSHA256Hex: item.hash
    })
    results.push({
      hash: item.hash,
      exists: false,
      url: put.url,
      headers: put.headers
    })
  }

  return results
}

/** Presign GETs for `{userId}/{hash}` only; omit hashes with no matching object. */
export async function planMediaDownloads(input: {
  userId: string
  hashes: string[]
}): Promise<MediaDownloadResult[]> {
  if (input.hashes.length === 0) return []

  const unique = [...new Set(input.hashes)]
  if (unique.length > MAX_MEDIA_ITEMS) {
    throw new BadRequestError(
      `At most ${MAX_MEDIA_ITEMS} media hashes per request`,
      'MEDIA_INVALID'
    )
  }

  for (const hash of unique) {
    if (!SHA256_HEX.test(hash)) {
      throw new BadRequestError(
        'hash must be lowercase SHA-256 hex',
        'MEDIA_INVALID'
      )
    }
  }

  const storage = getStorage()
  const results: MediaDownloadResult[] = []

  for (const hash of unique) {
    const key = storage.objectKey(input.userId, hash)
    const head = await storage.headObject(key)
    if (!head || head.contentLength == null || !head.contentType) continue

    const url = await storage.presignGet(key)
    results.push({
      hash,
      url,
      type: head.contentType,
      byteLength: head.contentLength
    })
  }

  return results
}

function walkMediaContents(
  value: unknown,
  visit: (content: unknown) => void
): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return
  }
  const obj = value as Record<string, unknown>
  const visitSide = (side: unknown) => {
    if (typeof side !== 'object' || side === null || Array.isArray(side)) return
    const s = side as Record<string, unknown>
    if (Array.isArray(s.blocks)) {
      for (const block of s.blocks) {
        if (typeof block !== 'object' || block === null) continue
        const b = block as Record<string, unknown>
        if (b.type === 'image' || b.type === 'audio') visit(b.content)
      }
      return
    }
    if (
      typeof s.content === 'object' &&
      s.content !== null &&
      ('hash' in s.content || 'buffer' in s.content || 'src' in s.content)
    ) {
      visit(s.content)
    }
  }
  visitSide(obj.front)
  visitSide(obj.back)
}

/** Collect unique wire refs from card mutations; flag malformed owned-media shapes. */
export async function collectBatchMediaRefs(
  mutations: Mutation[]
): Promise<{ refs: WireMediaRef[]; error: MediaRefError | null }> {
  const byHash = new Map<string, WireMediaRef>()
  let malformed: MediaRefError | null = null

  for (const mutation of mutations) {
    if (mutation.operation !== 'upsert' || mutation.table !== 'cards') continue
    if (!mutation.card) continue

    let data: unknown
    try {
      data = JSON.parse(mutation.card.dataJson)
    } catch {
      return {
        refs: [],
        error: new MediaRefError(
          'MEDIA_INVALID',
          'Card dataJson is not valid JSON',
          false
        )
      }
    }

    walkMediaContents(data, content => {
      if (malformed) return
      if (
        typeof content === 'object' &&
        content !== null &&
        'hash' in content &&
        !isWireMediaRef(content)
      ) {
        malformed = new MediaRefError(
          'MEDIA_INVALID',
          'Malformed media reference',
          false
        )
      }
    })
    if (malformed) return { refs: [], error: malformed }

    for (const ref of await collectWireMediaRefs(data)) {
      byHash.set(ref.hash, ref)
    }
  }

  return { refs: [...byHash.values()], error: null }
}

/**
 * HeadObject each unique ref once. Returns hash → error for refs that fail.
 * Shape/size failures are non-retryable; missing/mismatch are retryable.
 */
export async function checkReferencedMedia(input: {
  userId: string
  refs: WireMediaRef[]
}): Promise<Map<string, MediaRefError>> {
  const errors = new Map<string, MediaRefError>()
  const storage = getStorage()

  for (const ref of input.refs) {
    const shapeError = validateWireRefShape(ref)
    if (shapeError) {
      errors.set(ref.hash, shapeError)
      continue
    }

    const key = storage.objectKey(input.userId, ref.hash)
    const head = await storage.headObject(key)
    const headError = mediaErrorFromHead(head, ref)
    if (headError) errors.set(ref.hash, headError)
  }

  return errors
}

/** First media error for a card's dataJson, if any. */
export async function mediaErrorForCardData(
  dataJson: string,
  errorsByHash: Map<string, MediaRefError>
): Promise<MediaRefError | null> {
  let data: unknown
  try {
    data = JSON.parse(dataJson)
  } catch {
    return new MediaRefError(
      'MEDIA_INVALID',
      'Card dataJson is not valid JSON',
      false
    )
  }

  let malformed: MediaRefError | null = null
  walkMediaContents(data, content => {
    if (malformed) return
    if (
      typeof content === 'object' &&
      content !== null &&
      'hash' in content &&
      !isWireMediaRef(content)
    ) {
      malformed = new MediaRefError(
        'MEDIA_INVALID',
        'Malformed media reference',
        false
      )
    }
  })
  if (malformed) return malformed

  for (const ref of await collectWireMediaRefs(data)) {
    const err = errorsByHash.get(ref.hash)
    if (err) return err
  }
  return null
}
