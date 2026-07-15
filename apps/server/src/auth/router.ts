import { Router } from 'express'
import { requireAuth } from '../shared/middleware/require-auth.js'
import {
  googleCallbackHandler,
  meHandler,
  logoutHandler,
  refreshTokenHandler,
  emailRequestHandler,
  emailVerifyHandler
} from './handlers/index.js'

export const authRouter = Router()

authRouter.post('/oauth/google/callback', googleCallbackHandler)
authRouter.post('/email/request', emailRequestHandler)
authRouter.post('/email/verify', emailVerifyHandler)
authRouter.post('/token/refresh', refreshTokenHandler)
authRouter.post('/logout', requireAuth, logoutHandler)
authRouter.get('/me', requireAuth, meHandler)
