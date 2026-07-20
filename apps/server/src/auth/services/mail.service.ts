import { Resend } from 'resend'
import {
  brand,
  renderOtpEmailHtml,
  renderOtpEmailText
} from '../../emails/index.js'
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
  // Local/test placeholder key: skip Resend and stash code in Redis for manual and automated testing.
  if (
    (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') &&
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

  const expiresInMinutes = Math.max(1, Math.round(input.expiresInSeconds / 60))
  const emailParams = {
    code: input.code,
    expiresInMinutes,
    to: input.to
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: [input.to],
    subject: `Your ${brand.appName} login code`,
    text: renderOtpEmailText(emailParams),
    html: renderOtpEmailHtml(emailParams)
  })

  if (error) {
    throw new BadGatewayError('Failed to send email. Please try again.')
  }
}
