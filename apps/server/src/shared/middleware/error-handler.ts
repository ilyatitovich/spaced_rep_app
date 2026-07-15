import type { ErrorRequestHandler } from 'express'
import { AppError } from '../lib/errors.js'
import { statusToErrorCode } from '../lib/http.js'
import { logger } from '../lib/logger.js'
import { env } from '../config/env.js'

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code ?? statusToErrorCode(err.statusCode),
        message: err.message
      }
    })
    return
  }

  logger.error({ err }, 'Unhandled error')
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message:
        env.NODE_ENV === 'production' ? 'Internal server error' : String(err)
    }
  })
}
