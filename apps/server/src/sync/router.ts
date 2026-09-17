import { Router } from 'express'
import { requireAuth } from '../shared/middleware/require-auth.js'
import {
  bootstrapHandler,
  listDevicesHandler,
  pullHandler,
  pushHandler,
  revokeDeviceHandler
} from './handlers/sync.handler.js'

export const syncRouter = Router()

syncRouter.post('/push', requireAuth, pushHandler)
syncRouter.post('/pull', requireAuth, pullHandler)
syncRouter.post('/bootstrap', requireAuth, bootstrapHandler)
syncRouter.get('/devices', requireAuth, listDevicesHandler)
syncRouter.delete('/devices', requireAuth, revokeDeviceHandler)
