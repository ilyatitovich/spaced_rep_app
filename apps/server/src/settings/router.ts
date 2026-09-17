import { Router } from 'express'
import { requireAuth } from '../shared/middleware/require-auth.js'
import {
  createCheckoutHandler,
  getPortalHandler,
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
settingsRouter.post('/billing/checkout', requireAuth, createCheckoutHandler)
settingsRouter.post('/billing/portal', requireAuth, getPortalHandler)
