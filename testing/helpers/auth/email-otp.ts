import { createClient } from 'redis'
import { OTP_REDIS_KEY_PREFIX } from '../../config/constants.js'
import { getTestEnv, loadTestEnv } from '../../config/env.js'
import { createTestAgent } from '../http/supertest-app.js'

/** Cloudflare Turnstile always-pass test token. */
export const TURNSTILE_TEST_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'

export async function requestEmailOtp(email: string): Promise<void> {
  const agent = await createTestAgent()
  const res = await agent.post('/auth/email/request').send({
    email,
    turnstileToken: TURNSTILE_TEST_TOKEN
  })

  if (res.status >= 400) {
    throw new Error(
      `OTP request failed (${res.status}): ${JSON.stringify(res.body)}`
    )
  }
}

export async function readOtpFromRedis(email: string): Promise<string> {
  loadTestEnv()
  const { redisUrl } = getTestEnv()
  const client = createClient({ url: redisUrl })
  await client.connect()

  try {
    const code = await client.get(`${OTP_REDIS_KEY_PREFIX}${email}`)
    if (!code) {
      throw new Error(`No OTP found in Redis for ${email}`)
    }
    return code
  } finally {
    await client.quit()
  }
}

export async function verifyEmailOtp(
  email: string,
  code: string
): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: { id: string; email: string }
}> {
  const agent = await createTestAgent()
  const res = await agent.post('/auth/email/verify').send({ email, code })

  if (res.status >= 400) {
    throw new Error(
      `OTP verify failed (${res.status}): ${JSON.stringify(res.body)}`
    )
  }

  return res.body
}

/** Full email OTP login via API — for future auth e2e/integration tests. */
export async function loginViaEmailOtp(email: string) {
  await requestEmailOtp(email)
  const code = await readOtpFromRedis(email)
  return verifyEmailOtp(email, code)
}
