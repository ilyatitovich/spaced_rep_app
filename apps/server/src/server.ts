import { createApp } from './app.js'
import { env } from './shared/config/env.js'
import { logger } from './shared/lib/logger.js'
import { disconnectPrisma } from './shared/lib/prisma.js'

const app = createApp()

const server = app.listen(env.PORT, () => {
  logger.info(`Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`)
})

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`)
  server.close(() => {
    void disconnectPrisma()
      .catch(err => logger.error({ err }, 'Failed to disconnect Prisma'))
      .finally(() => {
        logger.info('Server closed')
        process.exit(0)
      })
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
