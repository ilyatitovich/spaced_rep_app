import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getTestPrisma } from '../../../../testing/db/prisma.js'
import {
  TURNSTILE_TEST_TOKEN,
  clearOtpCooldown
} from '../../../../testing/helpers/auth/email-otp.js'
import { createTestAgent } from '../../../../testing/helpers/http/supertest-app.js'

// A tiny ceiling so the test can reach it; the default is far higher.
vi.mock('../shared/config/env.js', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../shared/config/env.js')>()
  return { ...actual, env: { ...actual.env, OTP_GLOBAL_HOURLY_LIMIT: 2 } }
})

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ success: true }))
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function postRequest(email: string) {
  const agent = await createTestAgent()
  return agent
    .post('/auth/email/request')
    .send({ email, turnstileToken: TURNSTILE_TEST_TOKEN })
}

describe('request: global send ceiling', () => {
  it('stops sending codes once the hourly ceiling is spent, whoever asks', async () => {
    const emails = ['a', 'b', 'c'].map(
      label => `global-${label}-${Date.now()}@example.com`
    )
    for (const email of emails) await clearOtpCooldown(email)

    expect((await postRequest(emails[0]!)).status).toBe(200)
    expect((await postRequest(emails[1]!)).status).toBe(200)

    const over = await postRequest(emails[2]!)
    expect(over.status).toBe(429)
    expect(
      await getTestPrisma().otpCode.count({ where: { email: emails[2]! } })
    ).toBe(0)
  })
})
