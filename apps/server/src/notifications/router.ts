import { Router } from 'express'
import { requireAuth } from '../shared/middleware/require-auth.js'
import {
  deleteSubscriptionHandler,
  getVapidPublicKeyHandler,
  upsertSubscriptionHandler
} from './handlers/subscription.handler.js'

export const notificationsRouter = Router()

notificationsRouter.get('/vapid-public-key', getVapidPublicKeyHandler)
notificationsRouter.put(
  '/subscriptions',
  requireAuth,
  upsertSubscriptionHandler
)
notificationsRouter.delete(
  '/subscriptions',
  requireAuth,
  deleteSubscriptionHandler
)
