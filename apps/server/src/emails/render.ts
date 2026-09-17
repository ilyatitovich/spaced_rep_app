import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Handlebars from 'handlebars'
import juice from 'juice'
import { brand } from './brand.js'

const emailsDir = dirname(fileURLToPath(import.meta.url))
const handlebars = Handlebars.create()

function load(rel: string): string {
  return readFileSync(join(emailsDir, rel), 'utf8')
}

handlebars.registerPartial('base', load('layouts/base.html'))
handlebars.registerPartial('header', load('partials/header.html'))
handlebars.registerPartial('footer', load('partials/footer.html'))
handlebars.registerPartial('button', load('partials/button.html'))

const compiled = new Map<string, Handlebars.TemplateDelegate<Record<string, unknown>>>()

function compile(rel: string) {
  const cached = compiled.get(rel)
  if (cached) return cached
  const template = handlebars.compile<Record<string, unknown>>(load(rel))
  compiled.set(rel, template)
  return template
}

function context(data: Record<string, unknown>): Record<string, unknown> {
  return { brand, year: new Date().getFullYear(), ...data }
}

export function renderHtml(
  name: string,
  data: Record<string, unknown> = {}
): string {
  return juice(compile(`templates/${name}.html`)(context(data)))
}

export function renderText(
  name: string,
  data: Record<string, unknown> = {}
): string {
  return compile(`templates/${name}.txt`)(context(data)).trim()
}

export type OtpEmailParams = {
  code: string
  expiresInMinutes: number
  to: string
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const visible = local.slice(0, 1)
  return `${visible}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`
}

function otpData(params: OtpEmailParams): Record<string, unknown> {
  return {
    ...params,
    title: `Your ${brand.appName} login code`,
    maskedTo: maskEmail(params.to),
    minutesLabel:
      params.expiresInMinutes === 1
        ? '1 minute'
        : `${params.expiresInMinutes} minutes`
  }
}

export function renderOtpEmailHtml(params: OtpEmailParams): string {
  return renderHtml('otp', otpData(params))
}

export function renderOtpEmailText(params: OtpEmailParams): string {
  return renderText('otp', otpData(params))
}

export type NotificationEmailParams = {
  title: string
  body: string
  url?: string
}

export function renderNotificationEmailHtml(
  params: NotificationEmailParams
): string {
  return renderHtml('notification', params)
}

export function renderNotificationEmailText(
  params: NotificationEmailParams
): string {
  return renderText('notification', params)
}
