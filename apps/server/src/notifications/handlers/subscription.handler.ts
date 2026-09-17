import type { NextFunction, Request, Response } from 'express'
import { parseBody, sendData } from '../../shared/lib/http.js'
import {
  deleteSubscriptionSchema,
  upsertSubscriptionSchema
} from '../schemas/subscription.schemas.js'
import {
  deletePushSubscription,
  getVapidPublicKey,
  upsertPushSubscription
} from '../services/push.service.js'

export async function getVapidPublicKeyHandler(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    sendData(res, { publicKey: getVapidPublicKey() })
  } catch (err) {
    next(err)
  }
}

export async function upsertSubscriptionHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = parseBody(upsertSubscriptionSchema, req.body)
    const data = await upsertPushSubscription(
      req.auth!.userId,
      body,
      req.get('user-agent')
    )
    sendData(res, data)
  } catch (err) {
    next(err)
  }
}

export async function deleteSubscriptionHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = parseBody(deleteSubscriptionSchema, req.body)
    const deleted = await deletePushSubscription(
      req.auth!.userId,
      body.endpoint
    )
    sendData(res, { deleted })
  } catch (err) {
    next(err)
  }
}
