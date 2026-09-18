import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { R2Storage } from '../shared/lib/r2-storage.js'
import { sha256HexToBase64 } from '../shared/lib/r2-storage.js'
import {
  backfillOneCard,
  isBase64Media,
  rewriteBase64MediaToRefs,
  runMediaBackfill,
  type BackfillPrisma
} from './backfill-media.js'

function bytes(values: number[]): Uint8Array {
  return Uint8Array.from(values)
}

function b64(values: number[]): string {
  return Buffer.from(values).toString('base64')
}

function hashOf(values: number[]): string {
  return createHash('sha256').update(Buffer.from(values)).digest('hex')
}

function mockStorage(overrides: Partial<R2Storage> = {}): R2Storage {
  return {
    bucket: 'spaced-rep-media',
    objectKey: (userId, hash) => `${userId}/${hash}`,
    headObject: vi.fn().mockResolvedValue(null),
    putObject: vi.fn().mockResolvedValue(undefined),
    presignPut: vi.fn(),
    presignGet: vi.fn(),
    ...overrides
  }
}

describe('rewriteBase64MediaToRefs', () => {
  it('converts base64 buffers to stable refs and leaves src unchanged', () => {
    const png = [1, 2, 3, 4]
    const data = {
      front: {
        side: 'front',
        blocks: [
          {
            type: 'image',
            content: { buffer: b64(png), type: 'image/png' }
          },
          {
            type: 'image',
            content: { src: 'https://example.com/a.png' }
          }
        ]
      },
      back: {
        side: 'back',
        content: { buffer: b64(png), type: 'image/png' }
      }
    }

    const { wireData, mediaByHash, changed } = rewriteBase64MediaToRefs(data)
    const hash = hashOf(png)

    expect(changed).toBe(true)
    expect(mediaByHash.size).toBe(1)
    expect(mediaByHash.get(hash)?.type).toBe('image/png')
    expect(wireData).toEqual({
      front: {
        side: 'front',
        blocks: [
          {
            type: 'image',
            content: { hash, type: 'image/png', byteLength: 4 }
          },
          {
            type: 'image',
            content: { src: 'https://example.com/a.png' }
          }
        ]
      },
      back: {
        side: 'back',
        content: { hash, type: 'image/png', byteLength: 4 }
      }
    })
  })

  it('is a no-op when data already uses wire refs', () => {
    const hash = 'ab'.repeat(32)
    const data = {
      front: {
        blocks: [
          {
            type: 'image',
            content: { hash, type: 'image/png', byteLength: 10 }
          }
        ]
      },
      back: { blocks: [] }
    }

    const result = rewriteBase64MediaToRefs(data)
    expect(result.changed).toBe(false)
    expect(result.mediaByHash.size).toBe(0)
    expect(result.wireData).toEqual(data)
  })
})

describe('backfillOneCard / runMediaBackfill', () => {
  it('uploads before rewriting and never writes updatedAt', async () => {
    const png = [9, 8, 7]
    const hash = hashOf(png)
    const putOrder: string[] = []
    const storage = mockStorage({
      putObject: vi.fn(async () => {
        putOrder.push('put')
      })
    })
    const update = vi.fn(async () => {
      putOrder.push('update')
    })
    const prisma: BackfillPrisma = {
      card: {
        findMany: vi.fn(),
        update
      }
    }

    const result = await backfillOneCard({
      prisma,
      storage,
      card: {
        id: 'card-1',
        userId: 'user-1',
        data: {
          front: {
            blocks: [
              {
                type: 'image',
                content: { buffer: b64(png), type: 'image/png' }
              }
            ]
          },
          back: { blocks: [] }
        }
      }
    })

    expect(result).toEqual({ status: 'rewritten', uploaded: 1 })
    expect(putOrder).toEqual(['put', 'update'])
    expect(storage.putObject).toHaveBeenCalledWith({
      key: `user-1/${hash}`,
      body: bytes(png),
      contentType: 'image/png',
      checksumSHA256Hex: hash
    })
    expect(update).toHaveBeenCalledWith({
      where: { id: 'card-1' },
      data: {
        data: {
          front: {
            blocks: [
              {
                type: 'image',
                content: { hash, type: 'image/png', byteLength: 3 }
              }
            ]
          },
          back: { blocks: [] }
        }
      }
    })
    expect(update.mock.calls[0]![0].data).not.toHaveProperty('updatedAt')
  })

  it('skips put when HeadObject already matches', async () => {
    const png = [1, 1, 1]
    const hash = hashOf(png)
    const storage = mockStorage({
      headObject: vi.fn().mockResolvedValue({
        contentLength: 3,
        contentType: 'image/png',
        checksumSHA256: sha256HexToBase64(hash)
      })
    })
    const update = vi.fn().mockResolvedValue({})
    const prisma: BackfillPrisma = {
      card: { findMany: vi.fn(), update }
    }

    const result = await backfillOneCard({
      prisma,
      storage,
      card: {
        id: 'card-2',
        userId: 'user-1',
        data: {
          front: {
            content: { buffer: b64(png), type: 'image/png' }
          },
          back: {}
        }
      }
    })

    expect(result.uploaded).toBe(0)
    expect(storage.putObject).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalled()
  })

  it('does not rewrite when dryRun', async () => {
    const storage = mockStorage()
    const update = vi.fn()
    const prisma: BackfillPrisma = {
      card: { findMany: vi.fn(), update }
    }

    await backfillOneCard({
      prisma,
      storage,
      dryRun: true,
      card: {
        id: 'card-3',
        userId: 'user-1',
        data: {
          front: {
            content: { buffer: b64([2]), type: 'image/png' }
          },
          back: {}
        }
      }
    })

    expect(storage.putObject).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('leaves card untouched when upload fails', async () => {
    const storage = mockStorage({
      putObject: vi.fn().mockRejectedValue(new Error('R2 down'))
    })
    const update = vi.fn()
    const prisma: BackfillPrisma = {
      card: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'card-fail',
            userId: 'user-1',
            data: {
              front: {
                content: { buffer: b64([5]), type: 'image/png' }
              },
              back: {}
            }
          }
        ]),
        update
      }
    }

    const stats = await runMediaBackfill({ prisma, storage })
    expect(stats.rewritten).toBe(0)
    expect(stats.errors).toEqual([
      { cardId: 'card-fail', error: 'R2 down' }
    ])
    expect(update).not.toHaveBeenCalled()
  })
})

describe('isBase64Media', () => {
  it('detects base64 buffer records only', () => {
    expect(isBase64Media({ buffer: 'YQ==', type: 'image/png' })).toBe(true)
    expect(
      isBase64Media({
        hash: 'ab'.repeat(32),
        type: 'image/png',
        byteLength: 1
      })
    ).toBe(false)
    expect(isBase64Media({ src: 'https://x' })).toBe(false)
  })
})
