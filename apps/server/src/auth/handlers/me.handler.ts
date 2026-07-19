import type { Request, Response, NextFunction } from 'express'
import { UnauthorizedError } from '../../shared/lib/errors.js'
import { sendData } from '../../shared/lib/http.js'
import { prisma } from '../../shared/lib/prisma.js'

export async function meHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = req.auth!
    const user = await prisma.user.findFirst({
      where: {
        id: auth.userId,
        disabledAt: null
      },
      select: { id: true, email: true }
    })

    if (!user) {
      throw new UnauthorizedError('User not found or disabled')
    }

    sendData(res, { user })
  } catch (err) {
    next(err)
  }
}
