import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getTestPrisma } from '../../../../testing/db/prisma.js'
import {
  TURNSTILE_TEST_TOKEN,
  clearOtpCooldown,
  readOtpFromRedis
} from '../../../../testing/helpers/auth/email-otp.js'
import { createTestAgent } from '../../../../testing/helpers/http/supertest-app.js'
import { userFactory } from '../../../../testing/factories/user.factory.js'
import { getRedis } from '../shared/lib/redis.js'

const mailControl = vi.hoisted(() => ({ fail: false }))

// Wraps the real mail service so a single test can simulate a provider outage.
vi.mock('./services/mail.service.js', async importOriginal => {
  const actual =
    await importOriginal<typeof import('./services/mail.service.js')>()
  const { BadGatewayError } = await import('../shared/lib/errors.js')
  return {
    ...actual,
    sendOtpEmail: async (
      input: Parameters<typeof actual.sendOtpEmail>[0]
    ): Promise<void> => {
      if (mailControl.fail) {
        throw new BadGatewayError('Failed to send email. Please try again.')
      }
      return actual.sendOtpEmail(input)
    }
  }
})

const COOLDOWN_MESSAGE = 'Please wait before requesting another code.'
const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again later.'

function turnstileResponse(body: unknown) {
  return vi.fn(async () => Response.json(body))
}

beforeEach(() => {
  mailControl.fail = false
  // Hermetic: never call Cloudflare. supertest uses node http, not fetch.
  vi.stubGlobal('fetch', turnstileResponse({ success: true }))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function postRequest(
  email: string,
  turnstileToken = TURNSTILE_TEST_TOKEN
) {
  const agent = await createTestAgent()
  return agent.post('/auth/email/request').send({ email, turnstileToken })
}

async function postVerify(email: string, code: unknown) {
  const agent = await createTestAgent()
  return agent.post('/auth/email/verify').send({ email, code })
}

/** Request a code and return it (read from the dev Redis stash). */
async function issueCode(email: string): Promise<string> {
  const res = await postRequest(email)
  expect(res.status).toBe(200)
  return readOtpFromRedis(email)
}

function wrongCodeFor(code: string): string {
  return code === '000000' ? '111111' : '000000'
}

function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

async function latestChallenge(email: string) {
  return getTestPrisma().otpCode.findFirstOrThrow({
    where: { email },
    orderBy: { createdAt: 'desc' }
  })
}

describe('verify: wrong codes', () => {
  it('increments attempts on every wrong code', async () => {
    const email = uniqueEmail('attempts')
    const code = await issueCode(email)

    for (let i = 1; i <= 3; i++) {
      const res = await postVerify(email, wrongCodeFor(code))
      expect(res.status).toBe(401)
      expect(res.body.error?.code).toBe('OTP_INVALID')
      expect((await latestChallenge(email)).attempts).toBe(i)
    }
  })

  it('locks the challenge after OTP_MAX_ATTEMPTS, even for the correct code', async () => {
    const email = uniqueEmail('lockout')
    const code = await issueCode(email)
    const { maxAttempts } = await latestChallenge(email)

    for (let i = 0; i < maxAttempts; i++) {
      expect((await postVerify(email, wrongCodeFor(code))).status).toBe(401)
    }
    expect((await latestChallenge(email)).attempts).toBe(maxAttempts)

    const res = await postVerify(email, code)
    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('OTP_INVALID')
    expect(await getTestPrisma().session.count()).toBe(0)
  })

  it('does not tell an unknown email apart from a wrong code', async () => {
    const email = uniqueEmail('known')
    const code = await issueCode(email)

    const wrong = await postVerify(email, wrongCodeFor(code))
    const unknown = await postVerify(uniqueEmail('unknown'), '123456')

    expect(unknown.status).toBe(wrong.status)
    expect(unknown.body.error).toEqual(wrong.body.error)
  })
})

describe('verify: challenge lifecycle', () => {
  it('rejects an expired code', async () => {
    const email = uniqueEmail('expired')
    const code = await issueCode(email)
    await getTestPrisma().otpCode.updateMany({
      where: { email },
      data: { expiresAt: new Date(Date.now() - 1000) }
    })

    const res = await postVerify(email, code)
    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('OTP_INVALID')
  })

  it('rejects a code that was already consumed', async () => {
    const email = uniqueEmail('consumed')
    const code = await issueCode(email)

    expect((await postVerify(email, code)).status).toBe(200)

    const replay = await postVerify(email, code)
    expect(replay.status).toBe(401)
    expect(replay.body.error?.code).toBe('OTP_INVALID')
    expect(await getTestPrisma().session.count()).toBe(1)
  })

  it('invalidates the previous code when a new one is requested', async () => {
    const email = uniqueEmail('supersede')
    const first = await issueCode(email)
    await clearOtpCooldown(email)
    const second = await issueCode(email)

    // Astronomically unlikely, but would make the assertion below meaningless.
    expect(second).not.toBe(first)

    expect((await postVerify(email, first)).status).toBe(401)
    expect((await postVerify(email, second)).status).toBe(200)
  })

  it('lets only one of many concurrent verifications create a session', async () => {
    const { verifyEmailOtp } = await import('./services/email-otp.service.js')
    const email = uniqueEmail('concurrent')
    const code = await issueCode(email)

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => verifyEmailOtp({ email, code }))
    )

    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(await getTestPrisma().session.count()).toBe(1)
  })

  it('does not let a disabled user verify', async () => {
    const email = uniqueEmail('disabled')
    const user = await userFactory.create({ email })
    await getTestPrisma().user.update({
      where: { id: user.id },
      data: { disabledAt: new Date() }
    })
    const code = await issueCode(email)

    const res = await postVerify(email, code)
    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('OTP_INVALID')
    expect(await getTestPrisma().session.count()).toBe(0)

    const events = await getTestPrisma().securityEvent.findMany({
      where: { type: 'OTP_FAILED' }
    })
    expect(events.map(e => e.metadata)).toContainEqual({ reason: 'disabled' })
  })
})

describe('request: throttling', () => {
  it('enforces the resend cooldown without invalidating the live code', async () => {
    const email = uniqueEmail('cooldown')
    const code = await issueCode(email)

    const second = await postRequest(email)
    expect(second.status).toBe(429)
    expect(second.body.error).toEqual({
      code: 'RATE_LIMITED',
      message: COOLDOWN_MESSAGE
    })

    expect((await postVerify(email, code)).status).toBe(200)
  })

  it('rate limits requests per email', async () => {
    const email = uniqueEmail('per-email')

    for (let i = 0; i < 5; i++) {
      await clearOtpCooldown(email)
      expect((await postRequest(email)).status).toBe(200)
    }

    await clearOtpCooldown(email)
    const res = await postRequest(email)
    expect(res.status).toBe(429)
    expect(res.body.error?.message).toBe(RATE_LIMIT_MESSAGE)
  })

  it('rate limits requests per IP across different emails', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await postRequest(uniqueEmail(`per-ip-${i}`))).status).toBe(200)
    }

    const res = await postRequest(uniqueEmail('per-ip-over'))
    expect(res.status).toBe(429)
    expect(res.body.error?.message).toBe(RATE_LIMIT_MESSAGE)
  })

  it('rate limits verification attempts per email', async () => {
    const email = uniqueEmail('verify-limit')
    const code = await issueCode(email)

    for (let i = 0; i < 10; i++) {
      await postVerify(email, wrongCodeFor(code))
    }

    const res = await postVerify(email, code)
    expect(res.status).toBe(429)
    expect(res.body.error?.code).toBe('RATE_LIMITED')
  })
})

describe('fail closed', () => {
  it('rejects code requests when Redis is down (rate limiter)', async () => {
    vi.spyOn(getRedis(), 'incr').mockRejectedValue(new Error('redis down'))

    const res = await postRequest(uniqueEmail('redis-down'))

    expect(res.status).toBe(429)
    expect(await getTestPrisma().otpCode.count()).toBe(0)
  })

  it('rejects code requests when Redis is down (cooldown)', async () => {
    vi.spyOn(getRedis(), 'set').mockRejectedValue(new Error('redis down'))

    const res = await postRequest(uniqueEmail('redis-down-cooldown'))

    expect(res.status).toBe(429)
    expect(await getTestPrisma().otpCode.count()).toBe(0)
  })

  it('rejects verification when Redis is down', async () => {
    const email = uniqueEmail('redis-down-verify')
    const code = await issueCode(email)
    vi.spyOn(getRedis(), 'incr').mockRejectedValue(new Error('redis down'))

    const res = await postVerify(email, code)

    expect(res.status).toBe(429)
    expect(await getTestPrisma().session.count()).toBe(0)
  })
})

describe('mail provider failure', () => {
  it('deletes the challenge and clears the cooldown so the user can retry', async () => {
    const email = uniqueEmail('mail-down')
    mailControl.fail = true

    const failed = await postRequest(email)
    expect(failed.status).toBe(502)
    expect(failed.body.error?.code).toBe('BAD_GATEWAY')
    expect(await getTestPrisma().otpCode.count({ where: { email } })).toBe(0)

    mailControl.fail = false
    const retry = await postRequest(email)
    expect(retry.status).toBe(200)
    expect(await getTestPrisma().otpCode.count({ where: { email } })).toBe(1)
  })
})

describe('input validation and normalization', () => {
  it('treats the email case-insensitively end to end', async () => {
    const email = uniqueEmail('case')
    const mixed = email.replace(/^./, c => c.toUpperCase()).toUpperCase()

    expect((await postRequest(mixed)).status).toBe(200)
    const code = await readOtpFromRedis(email)

    const res = await postVerify(mixed, code)
    expect(res.status).toBe(200)
    expect(res.body.data.user.email).toBe(email)
    expect(await getTestPrisma().user.count({ where: { email } })).toBe(1)
  })

  // The schema's `.trim()` never runs: `z.email()` rejects surrounding
  // whitespace first. Pinned so a change here is a conscious decision.
  it('rejects emails with surrounding whitespace', async () => {
    const res = await postRequest(`  ${uniqueEmail('space')}  `)
    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('VALIDATION_ERROR')
  })

  it.each([
    ['too short', '12345'],
    ['too long', '1234567'],
    ['non-numeric', 'abcdef'],
    ['with whitespace', '123 456'],
    ['a number', 123456],
    ['missing', undefined]
  ])('rejects a malformed code (%s) with 400', async (_label, code) => {
    const res = await postVerify(uniqueEmail('malformed'), code)
    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an invalid email address', async () => {
    const res = await postRequest('not-an-email')
    expect(res.status).toBe(400)
  })
})

describe('turnstile', () => {
  it('rejects the request when Turnstile reports failure', async () => {
    vi.stubGlobal(
      'fetch',
      turnstileResponse({ 'success': false, 'error-codes': ['invalid-input'] })
    )

    const res = await postRequest(uniqueEmail('ts-fail'))

    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('TURNSTILE_FAILED')
    expect(await getTestPrisma().otpCode.count()).toBe(0)
  })

  it('rejects the request when the Turnstile call itself throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      })
    )

    const res = await postRequest(uniqueEmail('ts-throw'))

    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('TURNSTILE_FAILED')
    expect(await getTestPrisma().otpCode.count()).toBe(0)
  })

  it('does not spend rate limit or cooldown on a failed Turnstile check', async () => {
    const email = uniqueEmail('ts-no-cooldown')
    vi.stubGlobal('fetch', turnstileResponse({ success: false }))
    expect((await postRequest(email)).status).toBe(400)

    vi.stubGlobal('fetch', turnstileResponse({ success: true }))
    expect((await postRequest(email)).status).toBe(200)
  })

  it('requires a Turnstile token', async () => {
    const agent = await createTestAgent()
    const res = await agent
      .post('/auth/email/request')
      .send({ email: uniqueEmail('ts-missing') })

    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('VALIDATION_ERROR')
  })
})
