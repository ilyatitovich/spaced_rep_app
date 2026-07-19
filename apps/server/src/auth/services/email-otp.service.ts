import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import {
  AuthMethod,
  OtpPurpose,
  SecurityEventType
} from '../../generated/prisma/enums.js'
import { env } from '../../shared/config/env.js'
import { UnauthorizedError } from '../../shared/lib/errors.js'
import { prisma } from '../../shared/lib/prisma.js'
import {
  enforceCooldown,
  enforceRateLimit,
  getRedis
} from '../../shared/lib/redis.js'
import { sendOtpEmail } from './mail.service.js'
import {
  createSessionWithTokens,
  type TokenPairResult
} from './session.service.js'

const OTP_INVALID_MESSAGE = 'Invalid or expired code'
const HOUR = 60 * 60
const FIFTEEN_MIN = 15 * 60

function hashOtp(code: string): string {
  return createHmac('sha256', env.OTP_PEPPER).update(code).digest('hex')
}

function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

function otpHashesEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  )
}

async function resolveEmailUser(email: string): Promise<{
  id: string
  email: string
} | null> {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, disabledAt: true, emailVerifiedAt: true }
  })

  if (existing) {
    if (existing.disabledAt) return null
    if (!existing.emailVerifiedAt) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { emailVerifiedAt: new Date() }
      })
    }
    return { id: existing.id, email: existing.email }
  }

  try {
    return await prisma.user.create({
      data: {
        email,
        emailVerifiedAt: new Date()
      },
      select: { id: true, email: true }
    })
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    return resolveEmailUser(email)
  }
}

export async function requestEmailOtp(input: {
  email: string
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<void> {
  const ip = input.ipAddress ?? 'unknown'

  await enforceRateLimit({
    key: `otp:req:ip:${ip}`,
    limit: 10,
    windowSeconds: HOUR
  })
  await enforceRateLimit({
    key: `otp:req:email:${input.email}`,
    limit: 5,
    windowSeconds: HOUR
  })
  // Cooldown must run before send work, but only "locks" after success —
  // check via SET NX here so concurrent requests race cleanly.
  await enforceCooldown({
    key: `otp:cooldown:${input.email}`,
    seconds: env.OTP_RESEND_COOLDOWN_SECONDS
  })

  const code = generateOtp()
  const codeHash = hashOtp(code)
  const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000)

  await prisma.otpCode.updateMany({
    where: {
      email: input.email,
      purpose: OtpPurpose.LOGIN,
      consumedAt: null
    },
    data: { consumedAt: new Date() }
  })

  const challenge = await prisma.otpCode.create({
    data: {
      email: input.email,
      purpose: OtpPurpose.LOGIN,
      codeHash,
      expiresAt,
      maxAttempts: env.OTP_MAX_ATTEMPTS,
      requestIp: input.ipAddress ?? null
    },
    select: { id: true }
  })

  try {
    await sendOtpEmail({
      to: input.email,
      code,
      expiresInSeconds: env.OTP_TTL_SECONDS
    })
  } catch (err) {
    await prisma.otpCode.delete({ where: { id: challenge.id } }).catch(() => {})
    // Allow immediate retry after provider failure.
    try {
      const redis = getRedis()
      if (!redis.isOpen) await redis.connect()
      await redis.del(`otp:cooldown:${input.email}`)
    } catch {
      // ignore
    }
    throw err
  }

  await prisma.securityEvent.create({
    data: {
      type: SecurityEventType.OTP_REQUESTED,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: { purpose: OtpPurpose.LOGIN }
    }
  })
}

export async function verifyEmailOtp(input: {
  email: string
  code: string
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<TokenPairResult> {
  const ip = input.ipAddress ?? 'unknown'

  await enforceRateLimit({
    key: `otp:verify:ip:${ip}`,
    limit: 30,
    windowSeconds: FIFTEEN_MIN
  })
  await enforceRateLimit({
    key: `otp:verify:email:${input.email}`,
    limit: 10,
    windowSeconds: FIFTEEN_MIN
  })

  const challenge = await prisma.otpCode.findFirst({
    where: {
      email: input.email,
      purpose: OtpPurpose.LOGIN,
      consumedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  })

  const providedHash = hashOtp(input.code)

  if (!challenge || challenge.attempts >= challenge.maxAttempts) {
    await prisma.securityEvent.create({
      data: {
        type: SecurityEventType.OTP_FAILED,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: { reason: !challenge ? 'missing_or_expired' : 'max_attempts' }
      }
    })
    // Compare against dummy hash so missing-challenge path still does HMAC work.
    otpHashesEqual(providedHash, providedHash)
    throw new UnauthorizedError(OTP_INVALID_MESSAGE, 'OTP_INVALID')
  }

  if (!otpHashesEqual(providedHash, challenge.codeHash)) {
    await prisma.otpCode.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } }
    })
    await prisma.securityEvent.create({
      data: {
        type: SecurityEventType.OTP_FAILED,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: { reason: 'mismatch' }
      }
    })
    throw new UnauthorizedError(OTP_INVALID_MESSAGE, 'OTP_INVALID')
  }

  const consumed = await prisma.otpCode.updateMany({
    where: {
      id: challenge.id,
      consumedAt: null
    },
    data: { consumedAt: new Date() }
  })

  if (consumed.count !== 1) {
    throw new UnauthorizedError(OTP_INVALID_MESSAGE, 'OTP_INVALID')
  }

  const user = await resolveEmailUser(input.email)
  if (!user) {
    await prisma.securityEvent.create({
      data: {
        type: SecurityEventType.OTP_FAILED,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: { reason: 'disabled' }
      }
    })
    throw new UnauthorizedError(OTP_INVALID_MESSAGE, 'OTP_INVALID')
  }

  await prisma.otpCode.update({
    where: { id: challenge.id },
    data: { userId: user.id }
  })

  await prisma.securityEvent.create({
    data: {
      userId: user.id,
      type: SecurityEventType.OTP_SUCCEEDED,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null
    }
  })

  return createSessionWithTokens({
    userId: user.id,
    authMethod: AuthMethod.EMAIL_OTP,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: { method: 'email_otp' }
  })
}
