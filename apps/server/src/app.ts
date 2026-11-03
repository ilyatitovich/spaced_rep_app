import { randomUUID } from 'node:crypto'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { pinoHttp } from 'pino-http'
import { authRouter } from './auth/router.js'
import { notificationsRouter } from './notifications/router.js'
import { settingsRouter } from './settings/router.js'
import { billingWebhookHandler } from './settings/handlers/settings.handler.js'
import { syncRouter } from './sync/router.js'
import { env } from './shared/config/env.js'
import { checkHealth } from './shared/lib/health.js'
import { logger } from './shared/lib/logger.js'
import { errorHandler } from './shared/middleware/error-handler.js'

export function isAllowedOrigin(
  origin: string | undefined,
  allowed = env.CORS_ORIGIN
): boolean {
  return (
    origin === undefined || allowed.includes('*') || allowed.includes(origin)
  )
}

export function createApp() {
  const app = express()

  // Real client IP behind reverse proxies (needed for OTP rate limits).
  app.set('trust proxy', 1)

  app.use(helmet())
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin))
      }
    })
  )
  app.use(compression())
  app.use(
    pinoHttp({
      logger,
      genReqId(req, res) {
        const header = req.headers['x-request-id']
        const id =
          typeof header === 'string' && header.length > 0
            ? header
            : randomUUID()
        res.setHeader('x-request-id', id)
        return id
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]'
        ],
        censor: '[Redacted]'
      }
    })
  )
  app.post(
    '/settings/billing/webhook',
    express.raw({ type: 'application/json', limit: '256kb' }),
    billingWebhookHandler
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))

  app.get('/health', async (_req, res) => {
    const health = await checkHealth()
    res.status(health.status === 'ok' ? 200 : 503).json(health)
  })

  app.use('/auth', authRouter)
  app.use('/settings', settingsRouter)
  app.use('/sync', syncRouter)
  app.use('/notifications', notificationsRouter)

  app.use(errorHandler)

  return app
}
