import { randomUUID } from 'node:crypto'
import {
  MAX_CURSOR_LENGTH,
  MAX_PUSH_MUTATIONS,
  PROTOCOL_VERSION,
  createEnvelopeId,
  type Mutation
} from '@spaced-rep/sync-protocol'
import { describe, expect, it } from 'vitest'

import { getTestPrisma } from '../../../../testing/db/prisma.js'
import { createSessionForUser } from '../../../../testing/helpers/auth/session.js'
import { grantProPlan } from '../../../../testing/helpers/billing/grant-pro.js'
import { createTestAgent } from '../../../../testing/helpers/http/supertest-app.js'

/** Through the real app: body parser, auth, plan gate, schema, error handler. */
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

function topicUpsert(
  deviceId: string,
  overrides: Partial<Mutation> = {},
  weekJson = '[]'
) {
  const id = randomUUID()
  return {
    opId: randomUUID(),
    deviceId,
    table: 'topics',
    recordId: id,
    operation: 'upsert',
    updatedAt: Date.now(),
    topic: {
      id,
      title: `Topic ${id}`,
      pivot: 0,
      weekJson,
      nextUpdateDate: 0,
      updatedAt: Date.now()
    },
    ...overrides
  } satisfies Mutation
}

const pushBody = (deviceId: string, mutations: unknown[]) => ({
  ...envelope(deviceId),
  kind: 'pushBatch',
  pushBatch: { mutations }
})

describe('POST /sync/push request validation', () => {
  it('answers 413 PAYLOAD_TOO_LARGE for a body over the 1mb limit', async () => {
    const { post, deviceId } = await proAgent()
    const huge = topicUpsert(
      deviceId,
      {},
      JSON.stringify(['x'.repeat(1_200_000)])
    )

    const res = await post('/sync/push').send(pushBody(deviceId, [huge]))

    expect(res.status).toBe(413)
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('answers 400 INVALID_JSON for a truncated body', async () => {
    const { post } = await proAgent()

    const res = await post('/sync/push')
      .set('Content-Type', 'application/json')
      .send('{"version":4,"pushBatch":')

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_JSON')
  })

  it.each([
    ['a non-uuid opId', (d: string) => [topicUpsert(d, { opId: 'op-1' })]],
    [
      'a non-uuid recordId',
      (d: string) => [topicUpsert(d, { recordId: 'topic-1' })]
    ],
    [
      'more mutations than the cap',
      (d: string) =>
        Array.from({ length: MAX_PUSH_MUTATIONS + 1 }, () => topicUpsert(d))
    ]
  ])('answers 400 VALIDATION_ERROR for %s', async (_name, build) => {
    const { post, deviceId } = await proAgent()

    const res = await post('/sync/push').send(
      pushBody(deviceId, build(deviceId))
    )

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('answers 400 VALIDATION_ERROR for a non-uuid envelope deviceId', async () => {
    const { post } = await proAgent()

    const res = await post('/sync/push').send(
      pushBody('device-1', [topicUpsert(randomUUID())])
    )

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('stores nothing from a rejected batch', async () => {
    const { post, deviceId, tokens } = await proAgent()
    const good = topicUpsert(deviceId)

    await post('/sync/push').send(
      pushBody(deviceId, [good, topicUpsert(deviceId, { opId: 'op-1' })])
    )

    expect(
      await getTestPrisma().topic.count({ where: { userId: tokens.user.id } })
    ).toBe(0)
  })

  it('rejects a malformed op permanently while applying its batch neighbours', async () => {
    const { post, deviceId, tokens } = await proAgent()
    const good = topicUpsert(deviceId)
    const broken = topicUpsert(deviceId, {}, '[not json')

    const res = await post('/sync/push').send(
      pushBody(deviceId, [broken, good])
    )

    expect(res.status).toBe(200)
    const ack = res.body.pushAck
    expect(ack.acceptedOpIds).toEqual([good.opId])
    expect(ack.rejected).toEqual([
      {
        opId: broken.opId,
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        retryable: false
      }
    ])
    expect(
      await getTestPrisma().topic.count({ where: { userId: tokens.user.id } })
    ).toBe(1)
  })
})

describe('POST /sync/pull request validation', () => {
  it('answers 400 for a cursor longer than the limit', async () => {
    const { post, deviceId } = await proAgent()

    const res = await post('/sync/pull').send({
      ...envelope(deviceId),
      kind: 'pullRequest',
      pullRequest: { since: '9'.repeat(MAX_CURSOR_LENGTH + 1) }
    })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('treats a cursor beyond bigint range as "from the start" instead of a 500', async () => {
    const { post, deviceId } = await proAgent()

    const res = await post('/sync/pull').send({
      ...envelope(deviceId),
      kind: 'pullRequest',
      pullRequest: { since: '9'.repeat(40) }
    })

    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('pullDelta')
  })
})
