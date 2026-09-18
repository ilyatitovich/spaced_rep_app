import type { Request, Response, NextFunction } from 'express'
import { enforceRateLimit } from '../../shared/lib/redis.js'
import { BadRequestError } from '../../shared/lib/errors.js'
import { parseBody, sendData } from '../../shared/lib/http.js'
import { assertPlan } from '../../settings/services/plan.service.js'
import {
  mediaDownloadsBodySchema,
  mediaUploadsBodySchema
} from '../schemas/media.schemas.js'
import { planMediaDownloads, planMediaUploads } from '../media.service.js'

function requireAuthUser(req: Request): { userId: string } {
  if (!req.auth?.userId) {
    throw new BadRequestError('Unauthorized', 'UNAUTHORIZED')
  }
  return { userId: req.auth.userId }
}

export async function mediaUploadsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = requireAuthUser(req)
    await assertPlan(userId, 'PRO')
    await enforceRateLimit({
      key: `sync:media:uploads:${userId}`,
      limit: 120,
      windowSeconds: 60,
      message: 'Media upload rate limit exceeded'
    })

    const body = parseBody(mediaUploadsBodySchema, req.body)
    const items = await planMediaUploads({ userId, items: body.items })
    sendData(res, { items })
  } catch (err) {
    next(err)
  }
}

export async function mediaDownloadsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = requireAuthUser(req)
    await assertPlan(userId, 'PRO')
    await enforceRateLimit({
      key: `sync:media:downloads:${userId}`,
      limit: 120,
      windowSeconds: 60,
      message: 'Media download rate limit exceeded'
    })

    const body = parseBody(mediaDownloadsBodySchema, req.body)
    const items = await planMediaDownloads({ userId, hashes: body.hashes })
    sendData(res, { items })
  } catch (err) {
    next(err)
  }
}
