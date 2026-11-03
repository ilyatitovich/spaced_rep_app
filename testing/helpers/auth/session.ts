import { AuthMethod } from '../../../apps/server/src/generated/prisma/enums.js'
import { getTestPrisma } from '../../db/prisma.js'
import { userFactory } from '../../factories/user.factory.js'
import { createTestAgent } from '../http/supertest-app.js'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: { id: string; email: string }
}

/**
 * Create a verified user and session via the server session service.
 * Prefer this over email OTP when a test only needs an authenticated agent.
 */
export async function createSessionForUser(input?: {
  email?: string
  authMethod?: AuthMethod
  /** Reuse an existing user (e.g. second device session). */
  userId?: string
}): Promise<AuthTokens> {
  const { createSessionWithTokens } =
    await import('../../../apps/server/src/auth/services/session.service.js')

  if (input?.userId) {
    return createSessionWithTokens({
      userId: input.userId,
      authMethod: input.authMethod ?? AuthMethod.EMAIL_OTP
    })
  }

  const user = await userFactory.create({
    ...(input?.email !== undefined ? { email: input.email } : {}),
    emailVerifiedAt: new Date()
  })

  return createSessionWithTokens({
    userId: user.id,
    authMethod: input?.authMethod ?? AuthMethod.EMAIL_OTP
  })
}

export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  const agent = await createTestAgent()
  const res = await agent.post('/auth/token/refresh').send({ refreshToken })

  if (res.status >= 400) {
    throw new Error(
      `Token refresh failed (${res.status}): ${JSON.stringify(res.body)}`
    )
  }

  return res.body
}

export async function revokeSession(accessToken: string): Promise<void> {
  const agent = await createTestAgent()
  const res = await agent
    .post('/auth/logout')
    .set('Authorization', `Bearer ${accessToken}`)

  if (res.status >= 400) {
    throw new Error(
      `Logout failed (${res.status}): ${JSON.stringify(res.body)}`
    )
  }
}

export async function createAuthenticatedAgent(email?: string) {
  const tokens = await createSessionForUser(
    email !== undefined ? { email } : undefined
  )
  const agent = await createTestAgent()
  return {
    agent,
    tokens,
    authHeader: { Authorization: `Bearer ${tokens.accessToken}` }
  }
}

export async function findUserByEmail(email: string) {
  return getTestPrisma().user.findUnique({ where: { email } })
}
