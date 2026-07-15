import { Resend } from 'resend'
import { env } from '../../shared/config/env.js'
import { BadGatewayError } from '../../shared/lib/errors.js'
import { getRedis } from '../../shared/lib/redis.js'
import { logger } from '../../shared/lib/logger.js'

const resend = new Resend(env.RESEND_API_KEY)

export async function sendOtpEmail(input: {
  to: string
  code: string
  expiresInSeconds: number
}): Promise<void> {
  // Local placeholder key: skip Resend and stash code in Redis for manual testing.
  if (
    env.NODE_ENV === 'development' &&
    env.RESEND_API_KEY === 're_placeholder'
  ) {
    const redis = getRedis()
    if (!redis.isOpen) await redis.connect()
    await redis.set(`otp:dev:${input.to}`, input.code, { EX: 300 })
    logger.info(
      { to: input.to },
      'DEV: OTP emailed to Redis otp:dev:* (no Resend)'
    )
    return
  }

  const minutes = Math.max(1, Math.round(input.expiresInSeconds / 60))
  const text = [
    `Your login code is ${input.code}.`,
    `It expires in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    '',
    'If you did not request this code, you can ignore this email.'
  ].join('\n')

  const html = `
    <p>Your login code is <strong style="font-size:1.25em;letter-spacing:0.1em">${input.code}</strong>.</p>
    <p>It expires in ${minutes} minute${minutes === 1 ? '' : 's'}.</p>
    <p>If you did not request this code, you can ignore this email.</p>
  `.trim()

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: [input.to],
    subject: 'Your login code',
    text,
    html
  })

  if (error) {
    throw new BadGatewayError('Failed to send email. Please try again.')
  }
}
