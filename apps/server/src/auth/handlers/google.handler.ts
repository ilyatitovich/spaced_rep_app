import type { Request, Response, NextFunction } from 'express'
import { AuthMethod } from '../../generated/prisma/enums.js'
import { ForbiddenError } from '../../shared/lib/errors.js'
import { parseBody, sendData } from '../../shared/lib/http.js'
import { prisma } from '../../shared/lib/prisma.js'
import { googleCallbackSchema } from '../schemas/index.js'
import {
  exchangeGoogleCode,
  createSessionWithTokens
} from '../services/index.js'

const GOOGLE_PROVIDER = 'google'

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  )
}

async function resolveGoogleUser(input: {
  sub: string
  email: string
}): Promise<{ id: string; email: string }> {
  const existingIdentity = await prisma.oAuthIdentity.findUnique({
    where: {
      provider_providerUserId: {
        provider: GOOGLE_PROVIDER,
        providerUserId: input.sub
      }
    },
    include: {
      user: { select: { id: true, email: true, disabledAt: true } }
    }
  })

  if (existingIdentity) {
    if (existingIdentity.user.disabledAt) {
      throw new ForbiddenError('Account disabled')
    }
    if (existingIdentity.email !== input.email) {
      await prisma.oAuthIdentity.update({
        where: { id: existingIdentity.id },
        data: { email: input.email }
      })
    }
    return {
      id: existingIdentity.user.id,
      email: existingIdentity.user.email
    }
  }

  const userByEmail = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, disabledAt: true }
  })

  if (userByEmail) {
    if (userByEmail.disabledAt) {
      throw new ForbiddenError('Account disabled')
    }
    try {
      await prisma.oAuthIdentity.create({
        data: {
          userId: userByEmail.id,
          provider: GOOGLE_PROVIDER,
          providerUserId: input.sub,
          email: input.email
        }
      })
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      return resolveGoogleUser(input)
    }
    return userByEmail
  }

  try {
    const created = await prisma.user.create({
      data: {
        email: input.email,
        emailVerifiedAt: new Date(),
        oauthIdentities: {
          create: {
            provider: GOOGLE_PROVIDER,
            providerUserId: input.sub,
            email: input.email
          }
        }
      },
      select: { id: true, email: true }
    })
    return created
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    return resolveGoogleUser(input)
  }
}

export async function googleCallbackHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = parseBody(googleCallbackSchema, req.body)
    const claims = await exchangeGoogleCode(body)
    const user = await resolveGoogleUser({
      sub: claims.sub,
      email: claims.email
    })

    const tokens = await createSessionWithTokens({
      userId: user.id,
      authMethod: AuthMethod.OAUTH,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { provider: GOOGLE_PROVIDER }
    })

    sendData(res, tokens)
  } catch (err) {
    next(err)
  }
}
