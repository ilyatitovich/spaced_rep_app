import type { Server } from 'node:http'
import { createApp } from './app.js'
import { env } from './shared/config/env.js'
import { logger } from './shared/lib/logger.js'
import { disconnectPrisma } from './shared/lib/prisma.js'
import { connectRedis, getRedis } from './shared/lib/redis.js'
import {
  broadcastGracefulShutdown,
  createSyncWss
} from './sync/ws.handler.js'

const app = createApp()
let server: Server | null = null

async function main() {
  await connectRedis()
  server = app.listen(env.PORT, () => {
    logger.info(
      `Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`
    )
  })
  createSyncWss(server)
}

void main().catch(err => {
  logger.fatal({ err }, 'Failed to start server')
  process.exit(1)
})

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`)
  broadcastGracefulShutdown('server_restart')

  const closeHttp = server
    ? new Promise<void>((resolve, reject) => {
        server!.close(err => (err ? reject(err) : resolve()))
      })
    : Promise.resolve()

  void closeHttp
    .then(async () => {
      const redis = getRedis()
      if (redis.isOpen) await redis.quit()
      await disconnectPrisma()
    })
    .catch(err => logger.error({ err }, 'Shutdown error'))
    .finally(() => {
      logger.info('Server closed')
      process.exit(0)
    })

  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('unhandledRejection', reason => {
  logger.error({ reason }, 'Unhandled rejection')
})
process.on('uncaughtException', err => {
  logger.fatal({ err }, 'Uncaught exception — exiting')
  process.exit(1)
})
