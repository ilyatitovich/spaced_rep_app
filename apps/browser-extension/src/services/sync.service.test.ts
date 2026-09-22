import { isWireMediaRef, PROTOCOL_VERSION, sha256Hex } from '@spaced-rep/sync-protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { arrayBufferToBase64 } from '../../../client/src/lib/image'
import { encodeCardData, emptyCardData } from '../lib/card-codec'
import type { Card } from '../types'
import { getCard, saveCard } from './cards.service'
import { getOutbox, type OutboxItem } from './outbox.service'
import { buildOutboxMutations, flushOutbox } from './sync.service'

const values: Record<string, unknown> = {}

beforeEach(() => {
  for (const key of Object.keys(values)) delete values[key]
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: values[key] }),
        set: async (next: Record<string, unknown>) =>
          Object.assign(values, next),
        remove: async (key: string | string[]) => {
          for (const k of Array.isArray(key) ? key : [key]) delete values[k]
        }
      }
    }
  } as unknown as typeof chrome
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function bytes(values: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(values.length)
  new Uint8Array(buffer).set(values)
  return buffer
}

describe('buildOutboxMutations', () => {
  it('hashes base64 storage media into wire refs without mutating stored shape', async () => {
    const buffer = bytes([1, 2, 3, 4])
    const hash = await sha256Hex(buffer)
    const data = emptyCardData()
    data.front.blocks = [
      { type: 'image', content: { buffer, type: 'image/png' } }
    ]
    const encoded = encodeCardData(data)

    const item: OutboxItem = {
      id: 'op-1',
      cardId: 'card-1',
      attempts: 0,
      nextAttemptAt: 0
    }
    const card: Card = {
      id: 'card-1',
      topicId: 'topic-1',
      level: 1,
      data: encoded,
      updatedAt: 1_000
    }

    const { mutations, mediaByHash } = await buildOutboxMutations('device-1', [
      { item, card }
    ])

    expect(mediaByHash.get(hash)).toEqual({ buffer, type: 'image/png' })
    const wire = JSON.parse(mutations[0]!.card!.dataJson) as {
      front: { blocks: Array<{ content: unknown }> }
    }
    expect(isWireMediaRef(wire.front.blocks[0]!.content)).toBe(true)
    expect(wire.front.blocks[0]!.content).toEqual({
      hash,
      type: 'image/png',
      byteLength: 4
    })
    // Stored chrome.storage form stays base64.
    expect(encoded).toEqual({
      front: {
        side: 'front',
        blocks: [
          {
            type: 'image',
            content: arrayBufferToBase64({ buffer, type: 'image/png' })
          }
        ]
      },
      back: data.back
    })
  })
})

describe('flushOutbox', () => {
  it('uploads missing media before push and keeps outbox on upload failure', async () => {
    values['auth.session'] = {
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3_600_000,
      user: { id: 'u1', email: 'a@b.c' }
    }

    const buffer = bytes([9, 8, 7])
    const hash = await sha256Hex(buffer)
    const data = emptyCardData()
    data.front.blocks = [
      { type: 'image', content: { buffer, type: 'image/png' } }
    ]
    await saveCard(data, 'topic-1', true)

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/settings/subscription')) {
          return Response.json({
            data: { plan: 'pro', status: 'active', endsAt: null }
          })
        }
        if (url.includes('/sync/media/uploads')) {
          return Response.json({
            data: {
              items: [
                {
                  hash,
                  exists: false,
                  url: 'https://r2.example/put',
                  headers: {
                    'content-type': 'image/png',
                    'x-amz-checksum-sha256': 'checksum'
                  }
                }
              ]
            }
          })
        }
        if (url === 'https://r2.example/put') {
          return new Response(null, { status: 500 })
        }
        throw new Error(`Unexpected fetch: ${url} ${init?.method ?? 'GET'}`)
      }
    )
    vi.stubGlobal('fetch', fetchMock)

    await flushOutbox()

    const outbox = await getOutbox()
    expect(outbox).toHaveLength(1)
    expect(outbox[0]!.attempts).toBe(1)
    expect(
      fetchMock.mock.calls.some(
        ([url]) => String(url) === 'https://r2.example/put'
      )
    ).toBe(true)
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('/sync/push'))
    ).toBe(false)
  })

  it('clears outbox only after upload and push both succeed', async () => {
    values['auth.session'] = {
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3_600_000,
      user: { id: 'u1', email: 'a@b.c' }
    }

    const buffer = bytes([3, 2, 1])
    const hash = await sha256Hex(buffer)
    const data = emptyCardData()
    data.front.blocks = [
      { type: 'image', content: { buffer, type: 'image/png' } }
    ]
    const card = await saveCard(data, 'topic-1', true)

    const order: string[] = []
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/settings/subscription')) {
          return Response.json({
            data: { plan: 'pro', status: 'active', endsAt: null }
          })
        }
        if (url.includes('/sync/media/uploads')) {
          return Response.json({
            data: {
              items: [
                {
                  hash,
                  exists: false,
                  url: 'https://r2.example/put',
                  headers: {
                    'content-type': 'image/png',
                    'x-amz-checksum-sha256': 'checksum'
                  }
                }
              ]
            }
          })
        }
        if (url === 'https://r2.example/put') {
          order.push('upload')
          return new Response(null, { status: 200 })
        }
        if (url.includes('/sync/push')) {
          order.push('push')
          const body = JSON.parse(String(init?.body ?? '{}')) as {
            pushBatch?: { mutations?: { opId: string }[] }
          }
          return Response.json({
            version: PROTOCOL_VERSION,
            messageId: 'ack-1',
            deviceId: 'device-1',
            sentAt: Date.now(),
            kind: 'pushAck',
            pushAck: {
              acceptedOpIds: (body.pushBatch?.mutations ?? []).map(m => m.opId),
              rejected: [],
              conflicts: []
            }
          })
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }
    )
    vi.stubGlobal('fetch', fetchMock)

    await flushOutbox()

    expect(order).toEqual(['upload', 'push'])
    expect(await getOutbox()).toHaveLength(0)
    // chrome.storage still holds base64 bytes after a successful flush.
    const stored = await getCard(card.id)
    expect(stored?.data).toMatchObject({
      front: {
        blocks: [
          {
            type: 'image',
            content: expect.objectContaining({ buffer: expect.any(String) })
          }
        ]
      }
    })
  })
})
