import { Router, raw } from 'express'
import { requireAuth } from '../shared/middleware/require-auth.js'
import {
  bootstrapHandler,
  pullHandler,
  pushHandler
} from './handlers/sync.handler.js'

export const syncRouter = Router()

const protobufBody = raw({
  type: ['application/x-protobuf', 'application/octet-stream'],
  limit: '1mb'
})

syncRouter.post('/push', requireAuth, protobufBody, pushHandler)
syncRouter.post('/pull', requireAuth, protobufBody, pullHandler)
syncRouter.post('/bootstrap', requireAuth, protobufBody, bootstrapHandler)
