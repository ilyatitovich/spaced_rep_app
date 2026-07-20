import { BadRequestError } from '../../shared/lib/errors.js'
import { env } from '../../shared/config/env.js'

type TurnstileResponse = {
  'success': boolean
  'error-codes'?: string[]
}

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
        body
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
