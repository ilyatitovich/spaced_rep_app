import { Router } from 'express'
import { requireAuth } from '../shared/middleware/require-auth.js'
import {
  bootstrapHandler,
  pullHandler,
  pushHandler
} from './handlers/sync.handler.js'

export const syncRouter = Router()

syncRouter.post('/push', requireAuth, pushHandler)
syncRouter.post('/pull', requireAuth, pullHandler)
syncRouter.post('/bootstrap', requireAuth, bootstrapHandler)
