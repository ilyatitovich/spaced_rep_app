import type { NextFunction, Request, Response } from 'express'
import { parseBody, sendData } from '../../shared/lib/http.js'
import {
  patchLearningSchema,
  patchNotificationsSchema,
  patchPreferencesSchema,
  putRemindersSchema
} from '../schemas/settings.schemas.js'
import {
  getSettingsDocument,
  getSubscriptionDto,
  patchLearning,
  patchNotifications,
  patchPreferences,
  replaceReminders
} from '../services/settings.service.js'

export async function getSettingsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await getSettingsDocument(req.auth!.userId)
    sendData(res, data)
  } catch (err) {
    next(err)
  }
}

export async function patchPreferencesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = parseBody(patchPreferencesSchema, req.body)
    const data = await patchPreferences(req.auth!.userId, body)
    sendData(res, data)
  } catch (err) {
    next(err)
  }
}

export async function patchLearningHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = parseBody(patchLearningSchema, req.body)
    const data = await patchLearning(req.auth!.userId, body)
    sendData(res, data)
  } catch (err) {
    next(err)
  }
}

export async function patchNotificationsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = parseBody(patchNotificationsSchema, req.body)
    const data = await patchNotifications(req.auth!.userId, body)
    sendData(res, data)
  } catch (err) {
    next(err)
  }
}

export async function putRemindersHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = parseBody(putRemindersSchema, req.body)
    const data = await replaceReminders(req.auth!.userId, body)
    sendData(res, data)
  } catch (err) {
    next(err)
  }
}

export async function getSubscriptionHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await getSubscriptionDto(req.auth!.userId)
    sendData(res, data)
  } catch (err) {
    next(err)
  }
}

/** Stub: billing provider webhooks land here later. */
export async function billingWebhookHandler(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    sendData(res, { ok: true as const, received: true as const })
  } catch (err) {
    next(err)
  }
}
