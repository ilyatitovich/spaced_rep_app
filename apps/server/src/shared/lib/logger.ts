import pino from 'pino'
import { env } from '../config/env.js'
import { LOG_REDACT_PATHS } from './logger-redact.js'

const redact = {
  paths: [...LOG_REDACT_PATHS],
  censor: '[Redacted]'
}

export const logger = pino(
  env.NODE_ENV === 'development'
    ? {
        level: env.LOG_LEVEL,
        redact,
        transport: { target: 'pino-pretty', options: { colorize: true } }
      }
    : {
        level: env.LOG_LEVEL,
        redact
      }
)
