import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  createR2Storage,
  sha256HexToBase64
} from './r2-storage.js'

const ENDPOINT = process.env.R2_ENDPOINT || 'http://127.0.0.1:9000'
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || 'minioadmin'
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || 'minioadmin'
const BUCKET = process.env.R2_BUCKET || 'spaced-rep-media'

async function minioReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${ENDPOINT}/minio/health/live`, {
      signal: AbortSignal.timeout(1_500)
    })
    return response.ok
  } catch {
    return false
  }
}

describe('r2-storage MinIO (optional live check)', () => {
  it('presigned PUT with checksum round-trips through HEAD and GET', async context => {
    if (!(await minioReachable())) {
      context.skip()
      return
    }

    const body = Uint8Array.from([10, 20, 30, 40, 50])
    const hash = createHash('sha256').update(body).digest('hex')
    const key = `integration-test/${hash}`
    const storage = createR2Storage({
      bucket: BUCKET,
      region: 'us-east-1',
      endpoint: ENDPOINT,
      forcePathStyle: true,
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
      presignExpiresInSeconds: 300
    })

    const put = await storage.presignPut({
      key,
      contentType: 'image/png',
      checksumSHA256Hex: hash
    })

    const putResponse = await fetch(put.url, {
      method: 'PUT',
      headers: put.headers,
      body
    })
    expect(putResponse.ok).toBe(true)

    const head = await storage.headObject(key)
    expect(head?.contentLength).toBe(body.byteLength)
    expect(head?.contentType).toBe('image/png')
    // MinIO may omit checksum metadata on HeadObject; length/type are required.
    if (head?.checksumSHA256) {
      expect(head.checksumSHA256).toBe(sha256HexToBase64(hash))
    }

    const getUrl = await storage.presignGet(key)
    const getResponse = await fetch(getUrl)
    expect(getResponse.ok).toBe(true)
    const downloaded = new Uint8Array(await getResponse.arrayBuffer())
    expect([...downloaded]).toEqual([...body])
  })
})
