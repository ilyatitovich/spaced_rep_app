import { getRedis } from '../shared/lib/redis.js'
import { logger } from '../shared/lib/logger.js'
import type { SyncEnvelope } from '@spaced-rep/sync-protocol'

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
      envelope: input.envelope
    })
    await redis.publish(channel(input.userId), payload)
  } catch (err) {
    logger.warn({ err }, 'sync.fanout redis publish failed')
  }
}

function createSubscriber() {
  return getRedis().duplicate()
}

let subscriber: ReturnType<typeof createSubscriber> | null = null
let subscriberStarted = false

export async function startFanoutSubscriber(
  onRemote: (
    userId: string,
    envelope: SyncEnvelope,
    excludeDeviceId?: string
  ) => void
): Promise<void> {
  if (subscriberStarted) return
  subscriberStarted = true

  try {
    const redis = getRedis()
    if (!redis.isOpen) await redis.connect()

    const sub = createSubscriber()
    subscriber = sub
    // Without a listener, a Redis blip is an uncaught 'error' event and
    // server.ts exits on uncaughtException. node-redis reconnects by itself and
    // re-subscribes the pattern, so logging is all that is needed.
    sub.on('error', err => {
      logger.error({ err }, 'sync.fanout subscriber error')
    })
    await sub.connect()
    await sub.pSubscribe('sync:user:*', (message, ch) => {
      const userId = ch.replace('sync:user:', '')
      try {
        const parsed = JSON.parse(message) as {
          excludeDeviceId: string | null
          envelope: SyncEnvelope
        }
        onRemote(userId, parsed.envelope, parsed.excludeDeviceId ?? undefined)
      } catch (err) {
        logger.error({ err }, 'sync.fanout subscriber parse error')
      }
    })
    logger.info('sync.fanout redis subscriber started')
  } catch (err) {
    logger.warn({ err }, 'sync.fanout subscriber failed to start')
  }
}

/** Close the subscriber connection (shutdown). Safe to call when not started. */
export async function stopFanoutSubscriber(): Promise<void> {
  const sub = subscriber
  subscriber = null
  subscriberStarted = false
  if (!sub) return
  try {
    if (sub.isOpen) await sub.quit()
  } catch (err) {
    logger.warn({ err }, 'sync.fanout subscriber close failed')
    sub.destroy()
  }
}
