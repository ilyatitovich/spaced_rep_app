import { Router } from 'express'
import { requireAuth } from '../shared/middleware/require-auth.js'
import {
  mediaDownloadsHandler,
  mediaUploadsHandler
} from './handlers/media.handler.js'
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
syncRouter.post('/media/uploads', requireAuth, mediaUploadsHandler)
syncRouter.post('/media/downloads', requireAuth, mediaDownloadsHandler)
syncRouter.get('/devices', requireAuth, listDevicesHandler)
syncRouter.delete('/devices', requireAuth, revokeDeviceHandler)
