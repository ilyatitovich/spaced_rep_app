import { beforeEach, describe, expect, it, vi } from 'vitest'

const { send, getSignedUrl } = vi.hoisted(() => ({
  send: vi.fn(),
  getSignedUrl: vi.fn()
}))

vi.mock('@aws-sdk/client-s3', () => {
  class NotFound extends Error {
    name = 'NotFound'
  }
  class S3Client {
    send = send
  }
  return {
    NotFound,
    S3Client,
    HeadObjectCommand: class {
      input: unknown
      _tag = 'HeadObject'
      constructor(input: unknown) {
        this.input = input
      }
    },
    PutObjectCommand: class {
      input: unknown
      _tag = 'PutObject'
      constructor(input: unknown) {
        this.input = input
      }
    },
    GetObjectCommand: class {
      input: unknown
      _tag = 'GetObject'
      constructor(input: unknown) {
        this.input = input
      }
    }
  }
})

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrl(...args)
}))

const { createR2Storage, mediaObjectKey, sha256HexToBase64 } = await import(
  './r2-storage.js'
)

describe('r2-storage', () => {
  beforeEach(() => {
    send.mockReset()
    getSignedUrl.mockReset()
  })

  it('builds per-user object keys and base64 checksums', () => {
    expect(mediaObjectKey('user-1', 'ab'.repeat(32))).toBe(
      `user-1/${'ab'.repeat(32)}`
    )
    expect(sha256HexToBase64('00ff')).toBe(
      Buffer.from('00ff', 'hex').toString('base64')
    )
  })

  it('returns null when HeadObject is missing', async () => {
    const { NotFound } = await import('@aws-sdk/client-s3')
    send.mockRejectedValueOnce(new NotFound('missing'))
    const storage = createR2Storage({
      bucket: 'spaced-rep-media',
      region: 'us-east-1',
      endpoint: 'http://minio:9000',
      forcePathStyle: true,
      accessKeyId: 'minio',
      secretAccessKey: 'minio'
    })
    await expect(storage.headObject('u/hash')).resolves.toBeNull()
  })

  it('presigns PUT with content-type and checksum headers required', async () => {
    getSignedUrl.mockResolvedValueOnce('http://localhost:9000/put')
    const storage = createR2Storage({
      bucket: 'spaced-rep-media',
      region: 'us-east-1',
      endpoint: 'http://minio:9000',
      presignEndpoint: 'http://localhost:9000',
      forcePathStyle: true,
      accessKeyId: 'minio',
      secretAccessKey: 'minio',
      presignExpiresInSeconds: 300
    })

    const hashHex = 'aa'.repeat(32)
    const result = await storage.presignPut({
      key: 'user/hash',
      contentType: 'image/png',
      checksumSHA256Hex: hashHex
    })

    expect(result.url).toBe('http://localhost:9000/put')
    expect(result.headers).toEqual({
      'content-type': 'image/png',
      'x-amz-checksum-sha256': sha256HexToBase64(hashHex)
    })
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ _tag: 'PutObject' }),
      expect.objectContaining({
        expiresIn: 300,
        signableHeaders: new Set(['content-type']),
        unhoistableHeaders: new Set(['x-amz-checksum-sha256'])
      })
    )
    expect(getSignedUrl.mock.calls[0][1].input).toEqual(
      expect.objectContaining({
        Bucket: 'spaced-rep-media',
        Key: 'user/hash',
        ContentType: 'image/png',
        ChecksumSHA256: sha256HexToBase64(hashHex),
        ChecksumAlgorithm: 'SHA256'
      })
    )
  })
})
