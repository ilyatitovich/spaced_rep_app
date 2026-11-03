import { BadRequestError } from '../../shared/lib/errors.js'
import { env } from '../../shared/config/env.js'

interface TurnstileResponse {
  'success': boolean
  'error-codes'?: string[]
}

const VERIFY_TIMEOUT_MS = 5_000

/**
 * Every caller must pass Turnstile. Never skip on the `Origin` header: it is
 * attacker-controlled outside browsers (see ADR-3).
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string | null
): Promise<void> {
  const body = new URLSearchParams()
  body.set('secret', env.TURNSTILE_SECRET_KEY)
  body.set('response', token)
  if (remoteIp) body.set('remoteip', remoteIp)

  let result: TurnstileResponse
  try {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS)
      }
    )
    result = (await response.json()) as TurnstileResponse
  } catch {
    throw new BadRequestError(
      'Bot verification failed. Please try again.',
      'TURNSTILE_FAILED'
    )
  }

  if (!result.success) {
    throw new BadRequestError(
      'Bot verification failed. Please try again.',
      'TURNSTILE_FAILED'
    )
  }
}
