import type { AuthMethod } from '../../generated/prisma/enums.js'
import { SecurityEventType } from '../../generated/prisma/enums.js'
import type { Prisma } from '../../generated/prisma/client.js'
import { env } from '../../shared/config/env.js'
import { ForbiddenError, UnauthorizedError } from '../../shared/lib/errors.js'
import { prisma } from '../../shared/lib/prisma.js'
import {
  accessTokenExpiresIn,
  createRefreshToken,
  hashToken,
  signAccessToken
} from './token.service.js'

export type TokenPairResult = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
  user: { id: string; email: string }
}

type CreateSessionInput = {
  userId: string
  authMethod: AuthMethod
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Prisma.InputJsonValue
}

function secondsFromNow(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000)
}

export async function createSessionWithTokens(
  input: CreateSessionInput
): Promise<TokenPairResult> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, disabledAt: true }
  })

  if (!user) {
    throw new UnauthorizedError('User not found')
  }
  if (user.disabledAt) {
    throw new ForbiddenError('Account disabled')
  }

  const rawRefresh = createRefreshToken()
  const sessionExpiresAt = secondsFromNow(env.SESSION_TTL_SECONDS)
  const refreshExpiresAt = secondsFromNow(env.REFRESH_TOKEN_TTL_SECONDS)

  const session = await prisma.$transaction(async tx => {
    const created = await tx.session.create({
      data: {
        userId: input.userId,
        authMethod: input.authMethod,
        expiresAt: sessionExpiresAt,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        refreshTokens: {
          create: {
            tokenHash: hashToken(rawRefresh),
            expiresAt: refreshExpiresAt
          }
        }
      },
      select: { id: true }
    })

    await tx.securityEvent.create({
      data: {
        userId: input.userId,
        sessionId: created.id,
        type: SecurityEventType.SESSION_CREATED,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata ?? undefined
      }
    })

    return created
  })

  const accessToken = await signAccessToken({
    userId: input.userId,
    sessionId: session.id
  })

  return {
    accessToken,
    refreshToken: rawRefresh,
    expiresIn: accessTokenExpiresIn(),
    tokenType: 'Bearer',
    user: { id: user.id, email: user.email }
  }
}

export async function rotateRefreshToken(
  rawRefreshToken: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null }
): Promise<TokenPairResult> {
  const tokenHash = hashToken(rawRefreshToken)
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      session: {
        include: {
          user: { select: { id: true, email: true, disabledAt: true } }
        }
      }
    }
  })

  if (!existing) {
    throw new UnauthorizedError('Invalid refresh token')
  }

  if (existing.revokedAt || existing.replacedByTokenId) {
    await prisma.$transaction(async tx => {
      await tx.session.update({
        where: { id: existing.sessionId },
        data: { revokedAt: new Date() }
      })
      await tx.refreshToken.updateMany({
        where: { sessionId: existing.sessionId, revokedAt: null },
        data: { revokedAt: new Date() }
      })
      await tx.securityEvent.create({
        data: {
          userId: existing.session.userId,
          sessionId: existing.sessionId,
          type: SecurityEventType.REFRESH_REUSE_DETECTED,
          ipAddress: meta?.ipAddress ?? null,
          userAgent: meta?.userAgent ?? null
        }
      })
    })
    throw new UnauthorizedError('Refresh token reuse detected', 'REFRESH_REUSE')
  }

  if (existing.expiresAt <= new Date()) {
    throw new UnauthorizedError('Refresh token expired')
  }

  if (existing.session.revokedAt || existing.session.expiresAt <= new Date()) {
    throw new UnauthorizedError('Session revoked or expired')
  }

  if (existing.session.user.disabledAt) {
    throw new ForbiddenError('Account disabled')
  }

  const newRawRefresh = createRefreshToken()
  const refreshExpiresAt = secondsFromNow(env.REFRESH_TOKEN_TTL_SECONDS)

  const newToken = await prisma.$transaction(async tx => {
    const created = await tx.refreshToken.create({
      data: {
        sessionId: existing.sessionId,
        tokenHash: hashToken(newRawRefresh),
        expiresAt: refreshExpiresAt
      },
      select: { id: true }
    })

    await tx.refreshToken.update({
      where: { id: existing.id },
      data: {
        revokedAt: new Date(),
        replacedByTokenId: created.id
      }
    })

    await tx.session.update({
      where: { id: existing.sessionId },
      data: { lastActiveAt: new Date() }
    })

    await tx.securityEvent.create({
      data: {
        userId: existing.session.userId,
        sessionId: existing.sessionId,
        type: SecurityEventType.REFRESH_SUCCEEDED,
        ipAddress: meta?.ipAddress ?? null,
        userAgent: meta?.userAgent ?? null
      }
    })

    return created
  })

  void newToken

  const accessToken = await signAccessToken({
    userId: existing.session.userId,
    sessionId: existing.sessionId
  })

  return {
    accessToken,
    refreshToken: newRawRefresh,
    expiresIn: accessTokenExpiresIn(),
    tokenType: 'Bearer',
    user: {
      id: existing.session.user.id,
      email: existing.session.user.email
    }
  }
}

export async function revokeSession(
  sessionId: string,
  userId: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null }
) {
  await prisma.$transaction(async tx => {
    const session = await tx.session.findFirst({
      where: { id: sessionId, userId }
    })

    if (!session) {
      return
    }

    if (!session.revokedAt) {
      await tx.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() }
      })
    }

    await tx.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() }
    })

    await tx.securityEvent.create({
      data: {
        userId,
        sessionId,
        type: SecurityEventType.SESSION_REVOKED,
        ipAddress: meta?.ipAddress ?? null,
        userAgent: meta?.userAgent ?? null
      }
    })
  })
}
