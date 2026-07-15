import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { pinoHttp } from 'pino-http'
import { env } from './shared/config/env.js'
import { logger } from './shared/lib/logger.js'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cors({ origin: env.CORS_ORIGIN }))
  app.use(compression())
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(pinoHttp({ logger }))

  app.use('/health', (_, res) => {
    res.status(200).json({ status: 'ok' })
  })

  return app
}
