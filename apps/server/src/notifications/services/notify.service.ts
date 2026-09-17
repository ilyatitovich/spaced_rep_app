import { Resend } from 'resend'
import {
  brand,
  renderNotificationEmailHtml,
  renderNotificationEmailText
} from '../../emails/index.js'
import { env } from '../../shared/config/env.js'
import { prisma } from '../../shared/lib/prisma.js'
import { logger } from '../../shared/lib/logger.js'
import { sendPushToUser } from './push.service.js'

const resend = new Resend(env.RESEND_API_KEY)

export type NotifyChannel = 'PUSH' | 'EMAIL'

export type NotifyUserInput = {
  userId: string
  type: string
  title: string
  body: string
  url?: string
  channels: NotifyChannel[]
}

export async function notifyUser(input: NotifyUserInput): Promise<void> {
  const settings = await prisma.userNotificationSettings.findUnique({
    where: { userId: input.userId },
    select: { enabled: true }
  })
  if (!settings?.enabled) return

  const wantsPush = input.channels.includes('PUSH')
  const wantsEmail = input.channels.includes('EMAIL')

  if (wantsPush) {
    await sendPushToUser(input.userId, {
      title: input.title,
      body: input.body,
      url: input.url,
      type: input.type
    })
  }

  if (wantsEmail) {
    await sendNotificationEmail(input)
  }
}

async function sendNotificationEmail(input: NotifyUserInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, disabledAt: true }
  })
  if (!user || user.disabledAt) return

  if (
    (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') &&
    env.RESEND_API_KEY === 're_placeholder'
  ) {
    logger.info(
      { to: user.email, type: input.type, title: input.title },
      'DEV: notification email skipped (no Resend)'
    )
    return
  }

  const params = {
    title: input.title,
    body: input.body,
    url: input.url
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: [user.email],
    subject: `${brand.appName}: ${input.title}`,
    text: renderNotificationEmailText(params),
    html: renderNotificationEmailHtml(params)
  })

  if (error) {
    logger.error(
      { error, userId: input.userId, type: input.type },
      'Failed to send notification email'
    )
  }
}
