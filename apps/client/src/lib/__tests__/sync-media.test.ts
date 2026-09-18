import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  hydrateIncomingCardData,
  sha256HexToBase64,
  uploadOwnedMedia,
  type SyncMediaApi
} from '../sync-media'
import { sha256Hex } from '@spaced-rep/sync-protocol'

function bytes(values: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(values.length)
  new Uint8Array(buffer).set(values)
  return buffer
}

function bufferEquals(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false
  const left = new Uint8Array(a)
  const right = new Uint8Array(b)
  return left.every((value, i) => value === right[i])
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('sha256HexToBase64', () => {
  it('matches known hex→base64 digest', () => {
    // sha256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(
      sha256HexToBase64(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      )
    ).toBe('47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=')
  })
})

describe('uploadOwnedMedia', () => {
  it('PUTs missing objects with signed headers before returning', async () => {
    const buffer = bytes([1, 2, 3, 4])
    const hash = await sha256Hex(buffer)
    const put = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', put)

    const api: SyncMediaApi = {
      planUploads: vi.fn().mockResolvedValue([
        {
          hash,
          exists: false,
          url: 'https://r2.example/put',
          headers: {
            'content-type': 'image/png',
            'x-amz-checksum-sha256': sha256HexToBase64(hash)
          }
        }
      ]),
      planDownloads: vi.fn()
    }

    await uploadOwnedMedia(
      new Map([[hash, { buffer, type: 'image/png' }]]),
      api
    )

    expect(api.planUploads).toHaveBeenCalledOnce()
    expect(put).toHaveBeenCalledWith(
      'https://r2.example/put',
      expect.objectContaining({
        method: 'PUT',
        headers: {
          'content-type': 'image/png',
          'x-amz-checksum-sha256': sha256HexToBase64(hash)
        },
        body: buffer
      })
    )
  })

  it('skips PUT when the object already exists', async () => {
    const buffer = bytes([9])
    const hash = await sha256Hex(buffer)
    const put = vi.fn()
    vi.stubGlobal('fetch', put)

    const api: SyncMediaApi = {
      planUploads: vi.fn().mockResolvedValue([{ hash, exists: true }]),
      planDownloads: vi.fn()
    }

    await uploadOwnedMedia(
      new Map([[hash, { buffer, type: 'image/png' }]]),
      api
    )

    expect(put).not.toHaveBeenCalled()
  })

  it('retries PUT once after a 403', async () => {
    const buffer = bytes([5, 6])
    const hash = await sha256Hex(buffer)
    const put = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', put)

    const api: SyncMediaApi = {
      planUploads: vi
        .fn()
        .mockResolvedValueOnce([
          {
            hash,
            exists: false,
            url: 'https://r2.example/expired',
            headers: {
              'content-type': 'image/png',
              'x-amz-checksum-sha256': sha256HexToBase64(hash)
            }
          }
        ])
        .mockResolvedValueOnce([
          {
            hash,
            exists: false,
            url: 'https://r2.example/fresh',
            headers: {
              'content-type': 'image/png',
              'x-amz-checksum-sha256': sha256HexToBase64(hash)
            }
          }
        ]),
      planDownloads: vi.fn()
    }

    await uploadOwnedMedia(
      new Map([[hash, { buffer, type: 'image/png' }]]),
      api
    )

    expect(put).toHaveBeenNthCalledWith(
      2,
      'https://r2.example/fresh',
      expect.anything()
    )
  })
})

describe('hydrateIncomingCardData', () => {
  it('downloads, verifies, and replaces wire refs with buffers', async () => {
    const buffer = bytes([7, 8, 9])
    const hash = await sha256Hex(buffer)
    const get = vi
      .fn()
      .mockResolvedValue(new Response(buffer, { status: 200 }))
    vi.stubGlobal('fetch', get)

    const api: SyncMediaApi = {
      planUploads: vi.fn(),
      planDownloads: vi.fn().mockResolvedValue([
        {
          hash,
          url: 'https://r2.example/get',
          type: 'image/png',
          byteLength: 3
        }
      ])
    }

    const hydrated = await hydrateIncomingCardData(
      {
        watermark: '2020-01-01T00:00:00.000Z',
        more: false,
        records: [
          {
            card: {
              id: 'card-1',
              topicId: 'topic-1',
              level: 0,
              dataJson: JSON.stringify({
                front: {
                  side: 'front',
                  blocks: [
                    {
                      type: 'image',
                      content: { hash, type: 'image/png', byteLength: 3 }
                    }
                  ]
                },
                back: {
                  side: 'back',
                  blocks: [{ type: 'text', html: '<p>A</p>' }]
                }
              }),
              reviewDate: null,
              updatedAt: 1,
              deletedAt: null
            }
          }
        ]
      },
      api
    )

    const data = hydrated.get('card-1') as {
      front: { blocks: Array<{ content: { buffer: ArrayBuffer; type: string } }> }
    }
    expect(bufferEquals(data.front.blocks[0]!.content.buffer, buffer)).toBe(
      true
    )
    expect(data.front.blocks[0]!.content.type).toBe('image/png')
  })

  it('does not return hydrated data when integrity verification fails', async () => {
    const hash = 'a'.repeat(64)
    const get = vi
      .fn()
      .mockResolvedValue(new Response(bytes([1, 2, 3]), { status: 200 }))
    vi.stubGlobal('fetch', get)

    const api: SyncMediaApi = {
      planUploads: vi.fn(),
      planDownloads: vi.fn().mockResolvedValue([
        {
          hash,
          url: 'https://r2.example/get',
          type: 'image/png',
          byteLength: 3
        }
      ])
    }

    await expect(
      hydrateIncomingCardData(
        {
          watermark: '2020-01-01T00:00:00.000Z',
          more: false,
          records: [
            {
              card: {
                id: 'card-1',
                topicId: 'topic-1',
                level: 0,
                dataJson: JSON.stringify({
                  front: {
                    side: 'front',
                    blocks: [
                      {
                        type: 'image',
                        content: { hash, type: 'image/png', byteLength: 3 }
                      }
                    ]
                  },
                  back: { side: 'back', blocks: [] }
                }),
                reviewDate: null,
                updatedAt: 1,
                deletedAt: null
              }
            }
          ]
        },
        api
      )
    ).rejects.toThrow(/integrity/i)
  })

  it('throws when a referenced object is missing from the download plan', async () => {
    const hash = 'b'.repeat(64)
    const api: SyncMediaApi = {
      planUploads: vi.fn(),
      planDownloads: vi.fn().mockResolvedValue([])
    }

    await expect(
      hydrateIncomingCardData(
        {
          watermark: '2020-01-01T00:00:00.000Z',
          more: false,
          records: [
            {
              card: {
                id: 'card-1',
                topicId: 'topic-1',
                level: 0,
                dataJson: JSON.stringify({
                  front: {
                    side: 'front',
                    blocks: [
                      {
                        type: 'image',
                        content: { hash, type: 'image/png', byteLength: 1 }
                      }
                    ]
                  },
                  back: { side: 'back', blocks: [] }
                }),
                reviewDate: null,
                updatedAt: 1,
                deletedAt: null
              }
            }
          ]
        },
        api
      )
    ).rejects.toThrow(/not found/i)
  })
})
