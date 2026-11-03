import { describe, expect, it } from 'vitest'

import {
  loginViaEmailOtp,
  requestEmailOtp,
  verifyEmailOtp,
  readOtpFromRedis
} from '../../../../testing/helpers/auth/email-otp.js'
import {
  createSessionForUser,
  refreshTokens
} from '../../../../testing/helpers/auth/session.js'
import { createTestAgent } from '../../../../testing/helpers/http/supertest-app.js'
import { getTestPrisma } from '../../../../testing/db/prisma.js'

describe('email OTP', () => {
  it('request + verify returns tokens and creates a verified user', async () => {
    const email = `otp-int-${Date.now()}@example.com`

    await requestEmailOtp(email)
    const code = await readOtpFromRedis(email)
    const tokens = await verifyEmailOtp(email, code)

    expect(tokens.accessToken).toEqual(expect.any(String))
    expect(tokens.refreshToken).toEqual(expect.any(String))
    expect(tokens.user.email).toBe(email)

    const user = await getTestPrisma().user.findUnique({ where: { email } })
    expect(user?.emailVerifiedAt).toEqual(expect.any(Date))
  })
})

describe('refresh token reuse', () => {
  it('revokes the session when a rotated refresh token is reused', async () => {
    const first = await createSessionForUser()
    const rotated = await refreshTokens(first.refreshToken)

    const agent = await createTestAgent()
    const reuse = await agent
      .post('/auth/token/refresh')
      .send({ refreshToken: first.refreshToken })

    expect(reuse.status).toBe(401)
    expect(reuse.body.error?.code).toBe('REFRESH_REUSE')

    const meOld = await agent
      .get('/auth/me')
      .set('Authorization', `Bearer ${first.accessToken}`)
    expect(meOld.status).toBe(401)

    const meRotated = await agent
      .get('/auth/me')
      .set('Authorization', `Bearer ${rotated.accessToken}`)
    expect(meRotated.status).toBe(401)
  })
})

describe('disabled user', () => {
  it('cannot call a protected route for the rest of the access-token lifetime', async () => {
    const tokens = await createSessionForUser()
    await getTestPrisma().user.update({
      where: { id: tokens.user.id },
      data: { disabledAt: new Date() }
    })

    const agent = await createTestAgent()
    const res = await agent
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokens.accessToken}`)

    expect(res.status).toBe(403)
    expect(res.body.error?.code).toBe('FORBIDDEN')
  })
})

describe('loginViaEmailOtp helper', () => {
  it('completes the full OTP login path', async () => {
    const email = `otp-helper-${Date.now()}@example.com`
    const tokens = await loginViaEmailOtp(email)
    expect(tokens.user.email).toBe(email)
  })
})
