import type { NextFunction, Request, Response } from 'express'
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError
} from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { verifyAccessToken } from '../../auth/services/index.js'

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing bearer token')
    }

    const token = header.slice('Bearer '.length).trim()
    if (!token) {
      throw new UnauthorizedError('Missing bearer token')
    }

    const payload = await verifyAccessToken(token)

    const session = await prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      select: {
        id: true,
        user: { select: { disabledAt: true } }
      }
    })

    if (!session) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true }
      })
      if (!user) {
        throw new NotFoundError('Account not found')
      }
      throw new UnauthorizedError('Session revoked or expired')
    }

    if (session.user.disabledAt) {
      throw new ForbiddenError('Account disabled')
    }

    req.auth = { userId: payload.userId, sessionId: payload.sessionId }
    next()
  } catch (err) {
    next(err)
  }
}
