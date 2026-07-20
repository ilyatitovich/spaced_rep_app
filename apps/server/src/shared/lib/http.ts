import type { Response } from 'express'
import type { ZodType } from 'zod'
import { BadRequestError } from './errors.js'

export function sendData<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ data })
}

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) {
    const message = result.error.issues.map(i => i.message).join('; ')
    throw new BadRequestError(
      message || 'Invalid request body',
      'VALIDATION_ERROR'
    )
  }
  return result.data
}

export function statusToErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST'
    case 401:
      return 'UNAUTHORIZED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 429:
      return 'RATE_LIMITED'
    case 502:
      return 'BAD_GATEWAY'
    default:
      return statusCode >= 500 ? 'INTERNAL_ERROR' : 'ERROR'
  }
}
