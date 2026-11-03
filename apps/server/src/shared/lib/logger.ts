import pino from 'pino'
import { env } from '../config/env.js'

export const logger = pino(
  env.NODE_ENV === 'development'
    ? {
        level: env.LOG_LEVEL,
        transport: { target: 'pino-pretty', options: { colorize: true } }
      }
    : { level: env.LOG_LEVEL }
)
