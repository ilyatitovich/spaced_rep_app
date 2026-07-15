import { Router } from 'express'
import { requireAuth } from '../shared/middleware/require-auth.js'
import {
  googleCallbackHandler,
  meHandler,
  logoutHandler,
  refreshTokenHandler
} from './handlers/index.js'

export const authRouter = Router()

authRouter.post('/oauth/google/callback', googleCallbackHandler)
authRouter.post('/token/refresh', refreshTokenHandler)
authRouter.post('/logout', requireAuth, logoutHandler)
authRouter.get('/me', requireAuth, meHandler)
