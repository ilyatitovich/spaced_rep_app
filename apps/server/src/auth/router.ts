import { Router } from 'express'
import { requireAuth } from '../shared/middleware/require-auth.js'
import {
  googleCallbackHandler,
  meHandler,
  logoutHandler,
  refreshTokenHandler,
  emailRequestHandler,
  emailVerifyHandler,
  passkeyRegisterOptionsHandler,
  passkeyRegisterVerifyHandler,
  passkeyLoginOptionsHandler,
  passkeyLoginVerifyHandler,
  passkeyListHandler,
  passkeyDeleteHandler
} from './handlers/index.js'

export const authRouter = Router()

authRouter.post('/oauth/google/callback', googleCallbackHandler)
authRouter.post('/email/request', emailRequestHandler)
authRouter.post('/email/verify', emailVerifyHandler)
authRouter.post('/token/refresh', refreshTokenHandler)
authRouter.post('/logout', requireAuth, logoutHandler)
authRouter.get('/me', requireAuth, meHandler)

authRouter.post(
  '/passkeys/register/options',
  requireAuth,
  passkeyRegisterOptionsHandler
)
authRouter.post(
  '/passkeys/register/verify',
  requireAuth,
  passkeyRegisterVerifyHandler
)
authRouter.post('/passkeys/login/options', passkeyLoginOptionsHandler)
authRouter.post('/passkeys/login/verify', passkeyLoginVerifyHandler)
authRouter.get('/passkeys', requireAuth, passkeyListHandler)
authRouter.delete('/passkeys/:id', requireAuth, passkeyDeleteHandler)
