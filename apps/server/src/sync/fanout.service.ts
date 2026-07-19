import { getRedis } from '../shared/lib/redis.js'
import { logger } from '../shared/lib/logger.js'
import type { SyncEnvelope } from '@spaced-rep/sync-protocol'
import { encodeFrame } from '@spaced-rep/sync-protocol'

export type FanoutHandler = (
  userId: string,
  envelope: SyncEnvelope,
  excludeDeviceId?: string
) => void

const localHandlers = new Set<FanoutHandler>()

export function subscribeFanout(handler: FanoutHandler): () => void {
  localHandlers.add(handler)
  return () => localHandlers.delete(handler)
}

function channel(userId: string): string {
  return `sync:user:${userId}`
}

export async function publishFanout(input: {
  userId: string
  envelope: SyncEnvelope
  excludeDeviceId?: string
}): Promise<void> {
  for (const handler of localHandlers) {
    try {
      handler(input.userId, input.envelope, input.excludeDeviceId)
    } catch (err) {
      logger.error({ err }, 'sync.fanout local handler error')
    }
  }

  try {
    const redis = getRedis()
    if (!redis.isOpen) return

    const payload = JSON.stringify({
      excludeDeviceId: input.excludeDeviceId ?? null,
      frame: Buffer.from(encodeFrame(input.envelope)).toString('base64')
    })
    await redis.publish(channel(input.userId), payload)
  } catch (err) {
    logger.warn({ err }, 'sync.fanout redis publish failed')
  }
}

let subscriberStarted = false

export async function startFanoutSubscriber(
  onRemote: (userId: string, frame: Uint8Array, excludeDeviceId?: string) => void
): Promise<void> {
  if (subscriberStarted) return
  subscriberStarted = true

  try {
    const redis = getRedis()
    if (!redis.isOpen) await redis.connect()

    const sub = redis.duplicate()
    await sub.connect()
    await sub.pSubscribe('sync:user:*', (message, ch) => {
      const userId = ch.replace('sync:user:', '')
      try {
        const parsed = JSON.parse(message) as {
          excludeDeviceId: string | null
          frame: string
        }
        const frame = new Uint8Array(Buffer.from(parsed.frame, 'base64'))
        onRemote(userId, frame, parsed.excludeDeviceId ?? undefined)
      } catch (err) {
        logger.error({ err }, 'sync.fanout subscriber parse error')
      }
    })
    logger.info('sync.fanout redis subscriber started')
  } catch (err) {
    logger.warn({ err }, 'sync.fanout subscriber failed to start')
  }
}
