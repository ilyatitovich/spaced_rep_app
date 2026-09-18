import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sha256HexToBase64, type R2Storage } from '../shared/lib/r2-storage.js'
import {
  checkReferencedMedia,
  collectBatchMediaRefs,
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  planMediaDownloads,
  planMediaUploads,
  setMediaStorageForTests
} from './media.service.js'

const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)

function mockStorage(overrides: Partial<R2Storage> = {}): R2Storage {
  return {
    bucket: 'test',
    objectKey: (userId, hash) => `${userId}/${hash}`,
    headObject: vi.fn().mockResolvedValue(null),
    putObject: vi.fn(),
    presignPut: vi.fn().mockResolvedValue({
      url: 'https://r2.test/put',
      headers: {
        'content-type': 'image/png',
        'x-amz-checksum-sha256': sha256HexToBase64(HASH_A)
      }
    }),
    presignGet: vi.fn().mockResolvedValue('https://r2.test/get'),
    ...overrides
  }
}

describe('planMediaUploads', () => {
  beforeEach(() => {
    setMediaStorageForTests(null)
  })

  it('returns exists when HeadObject length/type/checksum match', async () => {
    const storage = mockStorage({
      headObject: vi.fn().mockResolvedValue({
        contentLength: 12,
        contentType: 'image/png',
        checksumSHA256: sha256HexToBase64(HASH_A)
      })
    })
    setMediaStorageForTests(storage)

    const items = await planMediaUploads({
      userId: 'user-1',
      items: [
        {
          hash: HASH_A,
          type: 'image/png',
          byteLength: 12,
          checksum: sha256HexToBase64(HASH_A)
        }
      ]
    })

    expect(items).toEqual([{ hash: HASH_A, exists: true }])
    expect(storage.presignPut).not.toHaveBeenCalled()
    expect(storage.headObject).toHaveBeenCalledWith(`user-1/${HASH_A}`)
  })

  it('presigns PUT when object is missing or metadata mismatches', async () => {
    const storage = mockStorage({
      headObject: vi.fn().mockResolvedValue({
        contentLength: 99,
        contentType: 'image/png',
        checksumSHA256: sha256HexToBase64(HASH_A)
      })
    })
    setMediaStorageForTests(storage)

    const items = await planMediaUploads({
      userId: 'user-1',
      items: [
        {
          hash: HASH_A,
          type: 'image/png',
          byteLength: 12,
          checksum: sha256HexToBase64(HASH_A)
        }
      ]
    })

    expect(items).toEqual([
      {
        hash: HASH_A,
        exists: false,
        url: 'https://r2.test/put',
        headers: {
          'content-type': 'image/png',
          'x-amz-checksum-sha256': sha256HexToBase64(HASH_A)
        }
      }
    ])
    expect(storage.presignPut).toHaveBeenCalledWith({
      key: `user-1/${HASH_A}`,
      contentType: 'image/png',
      checksumSHA256Hex: HASH_A
    })
  })

  it('rejects oversize images and bad checksums', async () => {
    setMediaStorageForTests(mockStorage())

    await expect(
      planMediaUploads({
        userId: 'user-1',
        items: [
          {
            hash: HASH_A,
            type: 'image/png',
            byteLength: MAX_IMAGE_BYTES + 1,
            checksum: sha256HexToBase64(HASH_A)
          }
        ]
      })
    ).rejects.toMatchObject({ code: 'MEDIA_TOO_LARGE' })

    await expect(
      planMediaUploads({
        userId: 'user-1',
        items: [
          {
            hash: HASH_A,
            type: 'audio/mpeg',
            byteLength: MAX_AUDIO_BYTES + 1,
            checksum: sha256HexToBase64(HASH_A)
          }
        ]
      })
    ).rejects.toMatchObject({ code: 'MEDIA_TOO_LARGE' })

    await expect(
      planMediaUploads({
        userId: 'user-1',
        items: [
          {
            hash: HASH_A,
            type: 'image/png',
            byteLength: 10,
            checksum: 'not-the-checksum'
          }
        ]
      })
    ).rejects.toMatchObject({ code: 'MEDIA_INVALID' })
  })

  it('dedupes identical hashes and scopes keys to the user', async () => {
    const storage = mockStorage()
    setMediaStorageForTests(storage)

    await planMediaUploads({
      userId: 'user-1',
      items: [
        {
          hash: HASH_A,
          type: 'image/png',
          byteLength: 10,
          checksum: sha256HexToBase64(HASH_A)
        },
        {
          hash: HASH_A,
          type: 'image/png',
          byteLength: 10,
          checksum: sha256HexToBase64(HASH_A)
        }
      ]
    })

    expect(storage.headObject).toHaveBeenCalledTimes(1)
    expect(storage.headObject).toHaveBeenCalledWith(`user-1/${HASH_A}`)
  })
})

describe('planMediaDownloads', () => {
  beforeEach(() => {
    setMediaStorageForTests(null)
  })

  it('returns GET URLs only for existing objects under the user key', async () => {
    const storage = mockStorage({
      headObject: vi.fn(async (key: string) => {
        if (key.endsWith(HASH_A)) {
          return {
            contentLength: 4,
            contentType: 'image/webp',
            checksumSHA256: sha256HexToBase64(HASH_A)
          }
        }
        return null
      })
    })
    setMediaStorageForTests(storage)

    const items = await planMediaDownloads({
      userId: 'user-1',
      hashes: [HASH_A, HASH_B, HASH_A]
    })

    expect(items).toEqual([
      {
        hash: HASH_A,
        url: 'https://r2.test/get',
        type: 'image/webp',
        byteLength: 4
      }
    ])
    expect(storage.objectKey('user-1', HASH_A)).toBe(`user-1/${HASH_A}`)
    expect(storage.presignGet).toHaveBeenCalledWith(`user-1/${HASH_A}`)
  })

  it('never resolves another user object key', async () => {
    const storage = mockStorage({
      headObject: vi.fn(async (key: string) => {
        if (key === `other-user/${HASH_A}`) {
          return {
            contentLength: 4,
            contentType: 'image/png',
            checksumSHA256: sha256HexToBase64(HASH_A)
          }
        }
        return null
      })
    })
    setMediaStorageForTests(storage)

    const items = await planMediaDownloads({
      userId: 'user-1',
      hashes: [HASH_A]
    })

    expect(items).toEqual([])
    expect(storage.headObject).toHaveBeenCalledWith(`user-1/${HASH_A}`)
    expect(storage.headObject).not.toHaveBeenCalledWith(`other-user/${HASH_A}`)
    expect(storage.presignGet).not.toHaveBeenCalled()
  })
})

describe('checkReferencedMedia', () => {
  beforeEach(() => {
    setMediaStorageForTests(null)
  })

  it('maps missing and integrity failures with retryable codes', async () => {
    const storage = mockStorage({
      headObject: vi.fn(async (key: string) => {
        if (key.endsWith(HASH_A)) return null
        return {
          contentLength: 1,
          contentType: 'image/png',
          checksumSHA256: 'wrong'
        }
      })
    })
    setMediaStorageForTests(storage)

    const errors = await checkReferencedMedia({
      userId: 'user-1',
      refs: [
        { hash: HASH_A, type: 'image/png', byteLength: 10 },
        { hash: HASH_B, type: 'image/png', byteLength: 10 }
      ]
    })

    expect(errors.get(HASH_A)).toMatchObject({
      code: 'MEDIA_NOT_FOUND',
      retryable: true
    })
    expect(errors.get(HASH_B)).toMatchObject({
      code: 'MEDIA_INTEGRITY',
      retryable: true
    })
  })

  it('flags oversized refs as non-retryable without HeadObject', async () => {
    const storage = mockStorage()
    setMediaStorageForTests(storage)

    const errors = await checkReferencedMedia({
      userId: 'user-1',
      refs: [
        {
          hash: HASH_A,
          type: 'image/png',
          byteLength: MAX_IMAGE_BYTES + 1
        }
      ]
    })

    expect(errors.get(HASH_A)).toMatchObject({
      code: 'MEDIA_TOO_LARGE',
      retryable: false
    })
    expect(storage.headObject).not.toHaveBeenCalled()
  })
})

describe('collectBatchMediaRefs', () => {
  it('collects unique refs and rejects malformed hash objects', async () => {
    const good = await collectBatchMediaRefs([
      {
        opId: 'op-1',
        deviceId: 'd1',
        table: 'cards',
        recordId: 'c1',
        operation: 'upsert',
        updatedAt: 1,
        card: {
          id: 'c1',
          topicId: 't1',
          level: 0,
          dataJson: JSON.stringify({
            front: {
              blocks: [
                {
                  type: 'image',
                  content: {
                    hash: HASH_A,
                    type: 'image/png',
                    byteLength: 3
                  }
                }
              ]
            },
            back: { blocks: [] }
          }),
          updatedAt: 1
        }
      }
    ])
    expect(good.error).toBeNull()
    expect(good.refs).toEqual([
      { hash: HASH_A, type: 'image/png', byteLength: 3 }
    ])

    const bad = await collectBatchMediaRefs([
      {
        opId: 'op-2',
        deviceId: 'd1',
        table: 'cards',
        recordId: 'c2',
        operation: 'upsert',
        updatedAt: 1,
        card: {
          id: 'c2',
          topicId: 't1',
          level: 0,
          dataJson: JSON.stringify({
            front: {
              content: { hash: 'not-a-sha', type: 'image/png', byteLength: 1 }
            },
            back: { blocks: [] }
          }),
          updatedAt: 1
        }
      }
    ])
    expect(bad.error).toMatchObject({ code: 'MEDIA_INVALID', retryable: false })
  })
})
