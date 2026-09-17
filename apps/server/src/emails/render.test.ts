import { describe, expect, it } from 'vitest'
import {
  renderNotificationEmailHtml,
  renderNotificationEmailText,
  renderOtpEmailHtml,
  renderOtpEmailText
} from './render.js'

const otp = {
  code: '123456',
  expiresInMinutes: 10,
  to: 'ada@example.com'
}

describe('render emails', () => {
  it('inlines css and interpolates otp fields', () => {
    const html = renderOtpEmailHtml(otp)
    expect(html).toContain('123456')
    expect(html).toContain('a**@example.com')
    expect(html).toContain('10 minutes')
    expect(html).toContain('style=')
    expect(html).not.toMatch(/<style[\s>]/i)
  })

  it('renders otp plaintext', () => {
    const text = renderOtpEmailText({ ...otp, expiresInMinutes: 1 })
    expect(text).toContain('123456')
    expect(text).toContain('1 minute')
    expect(text).not.toContain('<')
  })

  it('includes a cta only when url is set', () => {
    const withUrl = renderNotificationEmailHtml({
      title: 'Study',
      body: 'Due cards',
      url: 'https://example.com'
    })
    expect(withUrl).toContain('Open app')
    expect(withUrl).toContain('https://example.com')

    const withoutUrl = renderNotificationEmailHtml({
      title: 'Study',
      body: 'Due cards'
    })
    expect(withoutUrl).toContain('Due cards')
    expect(withoutUrl).not.toContain('Open app')
  })

  it('renders notification plaintext', () => {
    const text = renderNotificationEmailText({
      title: 'Study',
      body: 'Due cards',
      url: 'https://example.com'
    })
    expect(text).toContain('Study')
    expect(text).toContain('Due cards')
    expect(text).toContain('https://example.com')
  })
})
