import type { Request, Response, NextFunction } from 'express'
import { enforceRateLimit } from '../../shared/lib/redis.js'
import { deleteAccount } from '../services/account.service.js'

export async function deleteAccountHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = req.auth!
    await enforceRateLimit({
      key: `auth:delete:${auth.userId}`,
      limit: 5,
      windowSeconds: 3600
    })
    await deleteAccount(auth.userId)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}
