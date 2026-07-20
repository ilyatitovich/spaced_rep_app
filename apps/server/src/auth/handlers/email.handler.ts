import type { Request, Response, NextFunction } from 'express'
import { parseBody, sendData } from '../../shared/lib/http.js'
import { emailRequestSchema, emailVerifySchema } from '../schemas/index.js'
import {
  requestEmailOtp,
  verifyEmailOtp,
  verifyTurnstileToken
} from '../services/index.js'

export async function emailRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = parseBody(emailRequestSchema, req.body)
    await verifyTurnstileToken(body.turnstileToken, req.ip)
    await requestEmailOtp({
      email: body.email,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    })
    sendData(res, { ok: true as const })
  } catch (err) {
    next(err)
  }
}

export async function emailVerifyHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = parseBody(emailVerifySchema, req.body)
    const tokens = await verifyEmailOtp({
      email: body.email,
      code: body.code,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    })
    sendData(res, tokens)
  } catch (err) {
    next(err)
  }
}
