import { Writable } from 'node:stream'
import pino from 'pino'
import { describe, expect, it } from 'vitest'
import { LOG_REDACT_PATHS } from './logger-redact.js'

function captureLogger() {
  const lines: unknown[] = []
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(JSON.parse(String(chunk)))
      cb()
    }
  })
  const log = pino(
    {
      level: 'info',
      redact: { paths: LOG_REDACT_PATHS, censor: '[Redacted]' }
    },
    stream
  )
  return { log, lines }
}

describe('LOG_REDACT_PATHS', () => {
  it('redacts email addresses in common log shapes', () => {
    const { log, lines } = captureLogger()

    log.info(
      {
        email: 'user@example.com',
        to: 'user@example.com',
        user: { email: 'user@example.com' },
        req: { body: { email: 'user@example.com' } }
      },
      'otp'
    )

    const payload = JSON.stringify(lines[0])
    expect(payload).not.toContain('user@example.com')
    expect(payload).toContain('[Redacted]')
  })

  it('redacts lemon billing webhook fields', () => {
    const { log, lines } = captureLogger()

    log.info(
      {
        req: {
          body: {
            data: {
              attributes: {
                user_email: 'buyer@example.com',
                customer_id: 'cus_secret',
                status: 'active'
              }
            },
            meta: {
              custom_data: { user_id: 'uuid-1' }
            }
          }
        }
      },
      'webhook'
    )

    const payload = JSON.stringify(lines[0])
    expect(payload).not.toContain('buyer@example.com')
    expect(payload).not.toContain('cus_secret')
    expect(payload).toContain('[Redacted]')
  })
})
