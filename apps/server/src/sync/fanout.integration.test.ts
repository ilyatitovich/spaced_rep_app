import { randomUUID } from 'node:crypto'
import {
  PROTOCOL_VERSION,
  createEnvelopeId,
  type SyncEnvelope
} from '@spaced-rep/sync-protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getRedis } from '../shared/lib/redis.js'
import {
  startFanoutSubscriber,
  stopFanoutSubscriber
} from './fanout.service.js'

afterEach(async () => {
  await stopFanoutSubscriber()
})

function ping(): SyncEnvelope {
  return {
    version: PROTOCOL_VERSION,
    messageId: createEnvelopeId(),
    deviceId: randomUUID(),
    sentAt: Date.now(),
    kind: 'ping',
    ping: { timestamp: Date.now() }
  }
}

/** Publish as another API replica would: straight to Redis, not via local handlers. */
async function publishFromPeer(userId: string, envelope: SyncEnvelope) {
  const redis = getRedis()
  if (!redis.isOpen) await redis.connect()
  await redis.publish(
    `sync:user:${userId}`,
    JSON.stringify({ excludeDeviceId: null, envelope })
  )
}

/** Drop every pattern-subscribed connection, the way a Redis restart or failover would. */
async function killSubscriberConnections(): Promise<number> {
  const redis = getRedis()
  if (!redis.isOpen) await redis.connect()
  const list = (await redis.sendCommand([
    'CLIENT',
    'LIST',
    'TYPE',
    'pubsub'
  ])) as string
  const ids = list
    .split('\n')
    .filter(line => /\bpsub=[1-9]/.test(line))
    .map(line => /\bid=(\d+)/.exec(line)?.[1])
    .filter((id): id is string => id !== undefined)
  for (const id of ids) await redis.sendCommand(['CLIENT', 'KILL', 'ID', id])
  return ids.length
}

describe('fanout subscriber', () => {
  it('delivers envelopes published by another replica', async () => {
    const onRemote = vi.fn()
    await startFanoutSubscriber(onRemote)
    const userId = randomUUID()
    const envelope = ping()

    await publishFromPeer(userId, envelope)

    await vi.waitFor(() =>
      expect(onRemote).toHaveBeenCalledWith(userId, envelope, undefined)
    )
  })

  it('stays up when its connection drops, then resumes delivering', async () => {
    const onRemote = vi.fn()
    await startFanoutSubscriber(onRemote)
    const userId = randomUUID()

    // An unhandled 'error' event on the subscriber would crash the process
    // (server.ts exits on uncaughtException) — vitest reports it as a failure.
    expect(await killSubscriberConnections()).toBeGreaterThan(0)

    const envelope = ping()
    await vi.waitFor(
      async () => {
        await publishFromPeer(userId, envelope)
        expect(onRemote).toHaveBeenCalledWith(userId, envelope, undefined)
      },
      { timeout: 15_000, interval: 250 }
    )
  })

  it('can be stopped and started again', async () => {
    await startFanoutSubscriber(vi.fn())
    await stopFanoutSubscriber()

    const onRemote = vi.fn()
    await startFanoutSubscriber(onRemote)
    const userId = randomUUID()
    const envelope = ping()
    await publishFromPeer(userId, envelope)

    await vi.waitFor(() =>
      expect(onRemote).toHaveBeenCalledWith(userId, envelope, undefined)
    )
  })

  it('does not call a stopped subscriber', async () => {
    const onRemote = vi.fn()
    await startFanoutSubscriber(onRemote)
    await stopFanoutSubscriber()

    await publishFromPeer(randomUUID(), ping())
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(onRemote).not.toHaveBeenCalled()
  })
})
