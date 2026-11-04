import type { Server } from 'node:http'
import type { WebSocketServer } from 'ws'
import { createApp } from './app.js'
import {
  startReminderTicker,
  stopReminderTicker,
  whenReminderTickerIdle
} from './notifications/services/reminder-tick.service.js'
import { env } from './shared/config/env.js'
import {
  startRetentionJob,
  stopRetentionJob,
  whenRetentionJobIdle
} from './shared/jobs/retention.service.js'
import { performGracefulShutdown } from './shared/lib/graceful-shutdown.js'
import { logger } from './shared/lib/logger.js'
import { disconnectPrisma } from './shared/lib/prisma.js'
import { connectRedis, getRedis } from './shared/lib/redis.js'
import { captureServerException, initSentry } from './shared/lib/sentry.js'
import {
  startBillingReconciler,
  stopBillingReconciler,
  whenBillingReconcilerIdle
} from './settings/billing/billing.service.js'
import { stopFanoutSubscriber } from './sync/fanout.service.js'
import { broadcastGracefulShutdown, createSyncWss } from './sync/ws.handler.js'

initSentry()

const app = createApp()
let server: Server | null = null
let wss: WebSocketServer | null = null

async function main() {
  await connectRedis()
  server = app.listen(env.PORT, () => {
    logger.info(`Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`)
  })
  wss = createSyncWss(server)
  startBillingReconciler()
  startReminderTicker()
  startRetentionJob()
}

void main().catch(err => {
  logger.fatal({ err }, 'Failed to start server')
  process.exit(1)
})

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`)

  void performGracefulShutdown({
    stopBackgroundJobs: async () => {
      stopBillingReconciler()
      stopReminderTicker()
      stopRetentionJob()
      await Promise.all([
        whenBillingReconcilerIdle(),
        whenReminderTickerIdle(),
        whenRetentionJobIdle()
      ])
    },
    broadcastGracefulShutdown,
    wss,
    closeHttp: () =>
      server
        ? new Promise<void>((resolve, reject) => {
            server!.close(err => (err ? reject(err) : resolve()))
          })
        : Promise.resolve(),
    afterHttpClosed: async () => {
      await stopFanoutSubscriber()
      const redis = getRedis()
      if (redis.isOpen) await redis.quit()
      await disconnectPrisma()
    }
  })
    .then(() => {
      logger.info('Server closed')
      process.exit(0)
    })
    .catch(err => {
      logger.error({ err }, 'Shutdown error')
      process.exit(1)
    })

  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('unhandledRejection', reason => {
  logger.error({ reason }, 'Unhandled rejection')
  captureServerException(reason)
})
process.on('uncaughtException', err => {
  logger.fatal({ err }, 'Uncaught exception — exiting')
  captureServerException(err)
  process.exit(1)
})
