import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { pinoHttp } from 'pino-http'
import { authRouter } from './auth/router.js'
import { syncRouter } from './sync/router.js'
import { env } from './shared/config/env.js'
import { logger } from './shared/lib/logger.js'
import { errorHandler } from './shared/middleware/error-handler.js'

export function createApp() {
  const app = express()

  // Real client IP behind reverse proxies (needed for OTP rate limits).
  app.set('trust proxy', 1)

  app.use(helmet())
  app.use(cors({ origin: env.CORS_ORIGIN }))
  app.use(compression())
  // Skip JSON parser for protobuf sync routes (handled by raw middleware).
  app.use((req, res, next) => {
    if (req.path.startsWith('/sync/') && req.method === 'POST') {
      next()
      return
    }
    express.json({ limit: '1mb' })(req, res, next)
  })
  app.use(express.urlencoded({ extended: true }))
  app.use(pinoHttp({ logger }))

  app.use('/health', (req, res) => {
    res.status(200).json({ status: 'ok' })
  })

  app.use('/auth', authRouter)
  app.use('/sync', syncRouter)

  app.use(errorHandler)

  return app
}
