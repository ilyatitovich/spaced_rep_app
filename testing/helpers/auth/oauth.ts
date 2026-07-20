import { AuthMethod } from '../../../apps/server/src/generated/prisma/enums.js'
import { getTestPrisma } from '../../db/prisma.js'
import { userFactory } from '../../factories/user.factory.js'
import type { AuthTokens } from './session.js'

/**
 * OAuth e2e scaffolding.
 *
 * Full Google Authorization Code flow is not automated here. Prefer one of:
 * 1. Seed an OAuthIdentity + session for route tests that only need an authenticated user.
 * 2. Mock the Google token endpoint at the server boundary in a future phase.
 */
export async function createOAuthSession(input?: {
  email?: string
  provider?: string
  providerUserId?: string
}): Promise<AuthTokens> {
  const provider = input?.provider ?? 'google'
  const providerUserId = input?.providerUserId ?? crypto.randomUUID()

  const user = await userFactory.create({
    email: input?.email,
    emailVerifiedAt: new Date()
  })

  await getTestPrisma().oAuthIdentity.create({
    data: {
      userId: user.id,
      provider,
      providerUserId,
      email: user.email
    }
  })

  const { createSessionWithTokens } = await import(
    '../../../apps/server/src/auth/services/session.service.js'
  )

  return createSessionWithTokens({
    userId: user.id,
    authMethod: AuthMethod.OAUTH,
    metadata: { provider }
  })
}
