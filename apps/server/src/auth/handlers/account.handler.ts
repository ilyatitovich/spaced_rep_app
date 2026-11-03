import type { Request, Response, NextFunction } from 'express'
import { deleteAccount } from '../services/account.service.js'

export async function deleteAccountHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = req.auth!
    await deleteAccount(auth.userId)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}
