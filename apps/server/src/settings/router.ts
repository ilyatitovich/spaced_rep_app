import { Router } from 'express'
import { requireAuth } from '../shared/middleware/require-auth.js'
import {
  billingWebhookHandler,
  getSettingsHandler,
  getSubscriptionHandler,
  patchLearningHandler,
  patchNotificationsHandler,
  patchPreferencesHandler,
  putRemindersHandler
} from './handlers/settings.handler.js'

export const settingsRouter = Router()

settingsRouter.get('/', requireAuth, getSettingsHandler)
settingsRouter.patch('/preferences', requireAuth, patchPreferencesHandler)
settingsRouter.patch('/learning', requireAuth, patchLearningHandler)
settingsRouter.patch('/notifications', requireAuth, patchNotificationsHandler)
settingsRouter.put('/notifications/reminders', requireAuth, putRemindersHandler)
settingsRouter.get('/subscription', requireAuth, getSubscriptionHandler)

// Billing webhooks (no user JWT; provider signature verification TBD)
settingsRouter.post('/billing/webhook', billingWebhookHandler)
