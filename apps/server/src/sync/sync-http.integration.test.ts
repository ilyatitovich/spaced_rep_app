import { randomUUID } from 'node:crypto'
import {
  INITIAL_CURSOR,
  PROTOCOL_VERSION,
  createEnvelopeId,
  type Mutation
} from '@spaced-rep/sync-protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getTestPrisma } from '../../../../testing/db/prisma.js'
import { createSessionForUser } from '../../../../testing/helpers/auth/session.js'
import { grantProPlan } from '../../../../testing/helpers/billing/grant-pro.js'
import { createTestAgent } from '../../../../testing/helpers/http/supertest-app.js'
import { sha256HexToBase64, type R2Storage } from '../shared/lib/r2-storage.js'
import { setMediaStorageForTests } from './media.service.js'

const HASH = 'a'.repeat(64)

async function proAgent() {
  const tokens = await createSessionForUser()
  await grantProPlan(tokens.user.id)
  const agent = await createTestAgent()
  const post = (path: string) =>
    agent.post(path).set('Authorization', `Bearer ${tokens.accessToken}`)
  return { tokens, post, deviceId: randomUUID() }
}

function envelope(deviceId: string) {
  return {
    version: PROTOCOL_VERSION,
    messageId: createEnvelopeId(),
    deviceId,
    sentAt: Date.now()
  }
}

function topicUpsert(deviceId: string, title = 'HTTP topic'): Mutation {
  const id = randomUUID()
  const updatedAt = Date.now()
  return {
    opId: randomUUID(),
    deviceId,
    table: 'topics',
    recordId: id,
    operation: 'upsert',
    updatedAt,
    topic: {
      id,
      title,
      pivot: 0,
      weekJson: '[]',
      nextUpdateDate: 0,
      updatedAt
    }
  }
}

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
        'x-amz-checksum-sha256': sha256HexToBase64(HASH)
      }
    }),
    presignGet: vi.fn().mockResolvedValue('https://r2.test/get'),
    deletePrefix: vi.fn(),
    ...overrides
  }
}

describe('sync HTTP happy path', () => {
  afterEach(() => {
    setMediaStorageForTests(null)
  })

  it('POST /sync/push accepts a topic and stores it', async () => {
    const { post, deviceId, tokens } = await proAgent()
    const mutation = topicUpsert(deviceId)

    const res = await post('/sync/push').send({
      ...envelope(deviceId),
      kind: 'pushBatch',
      pushBatch: { mutations: [mutation] }
    })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('pushAck')
    expect(res.body.pushAck.acceptedOpIds).toEqual([mutation.opId])
    expect(res.body.pushAck.rejected).toEqual([])
    expect(
      await getTestPrisma().topic.findUnique({
        where: { id: mutation.recordId }
      })
    ).toMatchObject({
      userId: tokens.user.id,
      title: 'HTTP topic'
    })
  })

  it('POST /sync/pull returns a previously pushed topic', async () => {
    const { post, deviceId } = await proAgent()
    const mutation = topicUpsert(deviceId, 'Pull me')

    await post('/sync/push').send({
      ...envelope(deviceId),
      kind: 'pushBatch',
      pushBatch: { mutations: [mutation] }
    })

    const res = await post('/sync/pull').send({
      ...envelope(deviceId),
      kind: 'pullRequest',
      pullRequest: { since: INITIAL_CURSOR }
    })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('pullDelta')
    const topics = res.body.pullDelta.records
      .map((r: { topic?: { id: string; title: string } }) => r.topic)
      .filter(Boolean)
    expect(topics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: mutation.recordId,
          title: 'Pull me'
        })
      ])
    )
  })

  it('POST /sync/bootstrap returns the topic and registers the device', async () => {
    const { post, deviceId, tokens } = await proAgent()
    const mutation = topicUpsert(deviceId, 'Bootstrap me')

    await post('/sync/push').send({
      ...envelope(deviceId),
      kind: 'pushBatch',
      pushBatch: { mutations: [mutation] }
    })

    const bootstrapDeviceId = randomUUID()
    const res = await post('/sync/bootstrap').send({
      ...envelope(bootstrapDeviceId),
      kind: 'hello',
      hello: {
        lastPulledAt: INITIAL_CURSOR,
        pendingOpCount: 0,
        protocolVersion: PROTOCOL_VERSION
      }
    })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('pullDelta')
    const topics = res.body.pullDelta.records
      .map((r: { topic?: { id: string; title: string } }) => r.topic)
      .filter(Boolean)
    expect(topics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: mutation.recordId,
          title: 'Bootstrap me'
        })
      ])
    )
    expect(
      await getTestPrisma().syncDevice.findUnique({
        where: { id: bootstrapDeviceId }
      })
    ).toMatchObject({ userId: tokens.user.id })
  })

  it('POST /sync/media/uploads and /downloads go through auth and plan gate', async () => {
    const { post } = await proAgent()
    setMediaStorageForTests(
      mockStorage({
        headObject: vi.fn().mockResolvedValue({
          contentLength: 12,
          contentType: 'image/png',
          checksumSHA256: sha256HexToBase64(HASH)
        })
      })
    )

    const upload = await post('/sync/media/uploads').send({
      items: [
        {
          hash: HASH,
          type: 'image/png',
          byteLength: 12,
          checksum: sha256HexToBase64(HASH)
        }
      ]
    })
    expect(upload.status).toBe(200)
    expect(upload.body.data.items).toEqual([{ hash: HASH, exists: true }])

    const download = await post('/sync/media/downloads').send({
      hashes: [HASH]
    })
    expect(download.status).toBe(200)
    expect(download.body.data.items).toEqual([
      {
        hash: HASH,
        url: 'https://r2.test/get',
        type: 'image/png',
        byteLength: 12
      }
    ])
  })
})
