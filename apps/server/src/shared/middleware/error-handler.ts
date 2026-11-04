import type { ErrorRequestHandler } from 'express'
import { AppError } from '../lib/errors.js'
import { statusToErrorCode } from '../lib/http.js'
import { logger } from '../lib/logger.js'
import { captureServerException } from '../lib/sentry.js'
import { env } from '../config/env.js'

/**
 * The client-fault errors body-parser (and `http-errors` in general) raise:
 * oversized body, malformed JSON, unsupported charset or encoding. They carry a
 * 4xx `status` and are safe to show; without this they would surface as 500s.
 */
function clientFaultStatus(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null
  const { status, expose } = err as { status?: unknown; expose?: unknown }
  if (expose !== true || typeof status !== 'number') return null
  return status >= 400 && status < 500 ? status : null
}

function clientFaultBody(err: unknown, status: number) {
  const type = (err as { type?: unknown }).type
  if (type === 'entity.parse.failed') {
    return { code: 'INVALID_JSON', message: 'Request body is not valid JSON' }
  }
  if (type === 'entity.too.large') {
    return { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' }
  }
  return {
    code: statusToErrorCode(status),
    message: err instanceof Error ? err.message : 'Bad request'
  }
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code ?? statusToErrorCode(err.statusCode),
        message: err.message
      }
    })
    return
  }

  const status = clientFaultStatus(err)
  if (status !== null) {
    res.status(status).json({ error: clientFaultBody(err, status) })
    return
  }

  logger.error({ err, requestId: req.id }, 'Unhandled error')
  captureServerException(err, { requestId: req.id })
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message:
        env.NODE_ENV === 'production' ? 'Internal server error' : String(err)
    }
  })
}
