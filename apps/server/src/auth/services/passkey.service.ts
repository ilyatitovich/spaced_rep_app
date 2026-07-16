import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON
} from '@simplewebauthn/server'
import {
  AuthChallengeType,
  AuthMethod,
  SecurityEventType
} from '../../generated/prisma/enums.js'
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError
} from '../../shared/lib/errors.js'
import { prisma } from '../../shared/lib/prisma.js'
import { enforceRateLimit } from '../../shared/lib/redis.js'
import {
  createSessionWithTokens,
  type TokenPairResult
} from './session.service.js'
import {
  createAuthenticationOptions,
  createRegistrationOptions,
  getWebAuthnConfig,
  verifyAuthentication,
  verifyRegistration
} from './webauthn.service.js'

const HOUR = 60 * 60
const VERIFY_FAILED = 'Passkey verification failed'

export type PasskeySummary = {
  id: string
  name: string | null
  deviceType: string | null
  backedUp: boolean
  createdAt: string
  lastUsedAt: string | null
}

function toTransportList(
  transports: string[]
): AuthenticatorTransportFuture[] | undefined {
  if (transports.length === 0) return undefined
  return transports as AuthenticatorTransportFuture[]
}

function secondsFromNow(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000)
}

function extractClientChallenge(clientDataJSON: string): string {
  try {
    const json = Buffer.from(clientDataJSON, 'base64url').toString('utf8')
    const data = JSON.parse(json) as { challenge?: string }
    if (!data.challenge || typeof data.challenge !== 'string') {
      throw new Error('missing challenge')
    }
    return data.challenge
  } catch {
    throw new BadRequestError(VERIFY_FAILED, 'PASSKEY_VERIFY_FAILED')
  }
}

async function cleanupOldChallenges(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  try {
    await prisma.authChallenge.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: cutoff } }, { consumedAt: { lt: cutoff } }]
      }
    })
  } catch {
    // Opportunistic cleanup — never block auth
  }
}

async function storeChallenge(input: {
  userId: string | null
  type: AuthChallengeType
  challenge: string
}): Promise<void> {
  const { challengeTtlSeconds } = getWebAuthnConfig()
  await cleanupOldChallenges()
  await prisma.authChallenge.create({
    data: {
      userId: input.userId,
      type: input.type,
      challenge: input.challenge,
      expiresAt: secondsFromNow(challengeTtlSeconds)
    }
  })
}

async function findOpenChallenge(input: {
  challenge: string
  type: AuthChallengeType
  userId?: string
}): Promise<{ id: string; challenge: string }> {
  const row = await prisma.authChallenge.findFirst({
    where: {
      challenge: input.challenge,
      type: input.type,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      ...(input.userId ? { userId: input.userId } : {})
    },
    select: { id: true, challenge: true }
  })

  if (!row) {
    throw new UnauthorizedError(
      'Invalid or expired challenge',
      'CHALLENGE_INVALID'
    )
  }

  return row
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  )
}

export async function getRegisterOptions(input: {
  userId: string
  ipAddress?: string | null
}): Promise<PublicKeyCredentialCreationOptionsJSON> {
  await enforceRateLimit({
    key: `webauthn:reg:opts:user:${input.userId}`,
    limit: 20,
    windowSeconds: HOUR
  })
  if (input.ipAddress) {
    await enforceRateLimit({
      key: `webauthn:reg:opts:ip:${input.ipAddress}`,
      limit: 40,
      windowSeconds: HOUR
    })
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, disabledAt: true }
  })
  if (!user || user.disabledAt) {
    throw new ForbiddenError('Account disabled')
  }

  const passkeys = await prisma.passkey.findMany({
    where: { userId: input.userId, revokedAt: null },
    select: { credentialId: true, transports: true }
  })

  const options = await createRegistrationOptions({
    userId: user.id,
    email: user.email,
    excludeCredentials: passkeys.map(p => ({
      id: p.credentialId,
      transports: toTransportList(p.transports)
    }))
  })

  await storeChallenge({
    userId: user.id,
    type: AuthChallengeType.WEBAUTHN_REGISTER,
    challenge: options.challenge
  })

  return options
}

export async function verifyRegister(input: {
  userId: string
  credential: RegistrationResponseJSON
  name?: string
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<PasskeySummary> {
  await enforceRateLimit({
    key: `webauthn:reg:verify:user:${input.userId}`,
    limit: 20,
    windowSeconds: HOUR
  })

  const clientChallenge = extractClientChallenge(
    input.credential.response.clientDataJSON
  )
  const challengeRow = await findOpenChallenge({
    challenge: clientChallenge,
    type: AuthChallengeType.WEBAUTHN_REGISTER,
    userId: input.userId
  })

  let verification
  try {
    verification = await verifyRegistration({
      response: input.credential,
      expectedChallenge: challengeRow.challenge
    })
  } catch {
    await prisma.securityEvent.create({
      data: {
        userId: input.userId,
        type: SecurityEventType.PASSKEY_ASSERT_FAILED,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: { stage: 'register' }
      }
    })
    throw new BadRequestError(VERIFY_FAILED, 'PASSKEY_VERIFY_FAILED')
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw new BadRequestError(VERIFY_FAILED, 'PASSKEY_VERIFY_FAILED')
  }

  const { credential, credentialDeviceType, credentialBackedUp, aaguid } =
    verification.registrationInfo

  const transports =
    credential.transports?.map(String) ??
    input.credential.response.transports?.map(String) ??
    []

  let passkey
  try {
    passkey = await prisma.$transaction(async tx => {
      const consumed = await tx.authChallenge.updateMany({
        where: {
          id: challengeRow.id,
          consumedAt: null,
          expiresAt: { gt: new Date() }
        },
        data: { consumedAt: new Date() }
      })

      if (consumed.count !== 1) {
        throw new UnauthorizedError(
          'Invalid or expired challenge',
          'CHALLENGE_INVALID'
        )
      }

      return tx.passkey.create({
        data: {
          userId: input.userId,
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
          transports,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          aaguid: aaguid || null,
          name: input.name ?? null
        },
        select: {
          id: true,
          name: true,
          deviceType: true,
          backedUp: true,
          createdAt: true,
          lastUsedAt: true
        }
      })
    })
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof BadRequestError) {
      throw err
    }
    if (isUniqueViolation(err)) {
      throw new BadRequestError(
        'This passkey is already registered',
        'PASSKEY_VERIFY_FAILED'
      )
    }
    throw err
  }

  await prisma.securityEvent.create({
    data: {
      userId: input.userId,
      type: SecurityEventType.PASSKEY_REGISTERED,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: { passkeyId: passkey.id }
    }
  })

  return {
    id: passkey.id,
    name: passkey.name,
    deviceType: passkey.deviceType,
    backedUp: passkey.backedUp,
    createdAt: passkey.createdAt.toISOString(),
    lastUsedAt: passkey.lastUsedAt?.toISOString() ?? null
  }
}

export async function getLoginOptions(input: {
  email?: string
  ipAddress?: string | null
}): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const ip = input.ipAddress ?? 'unknown'
  await enforceRateLimit({
    key: `webauthn:login:opts:ip:${ip}`,
    limit: 60,
    windowSeconds: HOUR
  })

  let allowCredentials:
    | Array<{ id: string; transports?: AuthenticatorTransportFuture[] }>
    | undefined

  if (input.email) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        disabledAt: true,
        passkeys: {
          where: { revokedAt: null },
          select: { credentialId: true, transports: true }
        }
      }
    })

    if (user && !user.disabledAt && user.passkeys.length > 0) {
      allowCredentials = user.passkeys.map(p => ({
        id: p.credentialId,
        transports: toTransportList(p.transports)
      }))
    }
  }

  const options = await createAuthenticationOptions({ allowCredentials })

  await storeChallenge({
    userId: null,
    type: AuthChallengeType.WEBAUTHN_ASSERT,
    challenge: options.challenge
  })

  return options
}

export async function verifyLogin(input: {
  credential: AuthenticationResponseJSON
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<TokenPairResult> {
  const ip = input.ipAddress ?? 'unknown'
  await enforceRateLimit({
    key: `webauthn:login:verify:ip:${ip}`,
    limit: 60,
    windowSeconds: HOUR
  })

  const clientChallenge = extractClientChallenge(
    input.credential.response.clientDataJSON
  )
  const challengeRow = await findOpenChallenge({
    challenge: clientChallenge,
    type: AuthChallengeType.WEBAUTHN_ASSERT
  })

  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: input.credential.id },
    include: {
      user: { select: { id: true, email: true, disabledAt: true } }
    }
  })

  if (!passkey || passkey.revokedAt) {
    await prisma.securityEvent.create({
      data: {
        type: SecurityEventType.PASSKEY_ASSERT_FAILED,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: { reason: passkey?.revokedAt ? 'revoked' : 'not_found' }
      }
    })
    if (passkey?.revokedAt) {
      throw new UnauthorizedError('Passkey revoked', 'PASSKEY_REVOKED')
    }
    throw new UnauthorizedError('Passkey not found', 'PASSKEY_NOT_FOUND')
  }

  if (passkey.user.disabledAt) {
    throw new ForbiddenError('Account disabled')
  }

  let verification
  try {
    verification = await verifyAuthentication({
      response: input.credential,
      expectedChallenge: challengeRow.challenge,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: toTransportList(passkey.transports)
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : ''
    await prisma.securityEvent.create({
      data: {
        userId: passkey.userId,
        type: SecurityEventType.PASSKEY_ASSERT_FAILED,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: { reason: 'verify_failed' }
      }
    })
    if (message.includes('counter')) {
      throw new UnauthorizedError(
        'Passkey counter invalid',
        'PASSKEY_COUNTER_INVALID'
      )
    }
    throw new BadRequestError(VERIFY_FAILED, 'PASSKEY_VERIFY_FAILED')
  }

  if (!verification.verified) {
    throw new BadRequestError(VERIFY_FAILED, 'PASSKEY_VERIFY_FAILED')
  }

  const newCounter = verification.authenticationInfo.newCounter
  const now = new Date()

  await prisma.$transaction(async tx => {
    const consumed = await tx.authChallenge.updateMany({
      where: {
        id: challengeRow.id,
        consumedAt: null,
        expiresAt: { gt: now }
      },
      data: { consumedAt: now }
    })

    if (consumed.count !== 1) {
      throw new UnauthorizedError(
        'Invalid or expired challenge',
        'CHALLENGE_INVALID'
      )
    }

    await tx.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(newCounter),
        lastUsedAt: now,
        backedUp: verification.authenticationInfo.credentialBackedUp,
        deviceType: verification.authenticationInfo.credentialDeviceType
      }
    })

    await tx.securityEvent.create({
      data: {
        userId: passkey.userId,
        type: SecurityEventType.PASSKEY_ASSERTED,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: { passkeyId: passkey.id }
      }
    })
  })

  return createSessionWithTokens({
    userId: passkey.userId,
    authMethod: AuthMethod.PASSKEY,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: { passkeyId: passkey.id }
  })
}

export async function listPasskeys(userId: string): Promise<{
  passkeys: PasskeySummary[]
}> {
  const rows = await prisma.passkey.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      deviceType: true,
      backedUp: true,
      createdAt: true,
      lastUsedAt: true
    }
  })

  return {
    passkeys: rows.map(p => ({
      id: p.id,
      name: p.name,
      deviceType: p.deviceType,
      backedUp: p.backedUp,
      createdAt: p.createdAt.toISOString(),
      lastUsedAt: p.lastUsedAt?.toISOString() ?? null
    }))
  }
}

export async function revokePasskey(input: {
  userId: string
  passkeyId: string
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<{ ok: true }> {
  const existing = await prisma.passkey.findFirst({
    where: {
      id: input.passkeyId,
      userId: input.userId,
      revokedAt: null
    },
    select: { id: true }
  })

  if (!existing) {
    throw new NotFoundError('Passkey not found')
  }

  await prisma.passkey.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() }
  })

  await prisma.securityEvent.create({
    data: {
      userId: input.userId,
      type: SecurityEventType.PASSKEY_REGISTERED,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: { action: 'revoked', passkeyId: existing.id }
    }
  })

  return { ok: true as const }
}
