import pino from 'pino'
import { env } from '../config/env.js'

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie'
]

export const logger = pino(
  env.NODE_ENV === 'development'
    ? {
        level: env.LOG_LEVEL,
        redact: redactPaths,
        transport: { target: 'pino-pretty', options: { colorize: true } }
      }
    : {
        level: env.LOG_LEVEL,
        redact: redactPaths
      }
)
