import type { NextFunction, Request, Response } from 'express'
import { parseBody, sendData } from '../../shared/lib/http.js'
import {
  extensionGrantSchema,
  extensionTokenSchema
} from '../schemas/extension.schemas.js'
import {
  createExtensionGrant,
  exchangeExtensionGrant
} from '../services/extension.service.js'

export async function extensionGrantHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = parseBody(extensionGrantSchema, req.body)
    sendData(
      res,
      await createExtensionGrant({ ...body, userId: req.auth!.userId })
    )
  } catch (error) {
    next(error)
  }
}

export async function extensionTokenHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = parseBody(extensionTokenSchema, req.body)
    sendData(
      res,
      await exchangeExtensionGrant({
        ...body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      })
    )
  } catch (error) {
    next(error)
  }
}
