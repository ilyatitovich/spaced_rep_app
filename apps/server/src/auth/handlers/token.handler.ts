import type { Request, Response, NextFunction } from 'express'
import { parseBody, sendData } from '../../shared/lib/http.js'
import { refreshTokenSchema } from '../schemas/index.js'
import { rotateRefreshToken, revokeSession } from '../services/index.js'

export async function refreshTokenHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = parseBody(refreshTokenSchema, req.body)
    const tokens = await rotateRefreshToken(body.refreshToken, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    })
    sendData(res, tokens)
  } catch (err) {
    next(err)
  }
}

export async function logoutHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = req.auth!
    await revokeSession(auth.sessionId, auth.userId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    })
    sendData(res, { ok: true })
  } catch (err) {
    next(err)
  }
}
