import { describe, expect, it } from 'vitest'
import { scrubSentryEvent } from './sentry-scrub.js'

describe('scrubSentryEvent', () => {
  it('strips emails from request bodies and user context', () => {
    const event = scrubSentryEvent({
      user: { email: 'user@example.com', id: 'u1' },
      request: {
        data: {
          email: 'user@example.com',
          code: '123456'
        },
        headers: {
          'authorization': 'Bearer secret',
          'content-type': 'application/json'
        }
      },
      extra: {
        to: 'user@example.com',
        user_email: 'buyer@example.com'
      }
    })

    expect(event.user?.email).toBeUndefined()
    expect(event.user?.id).toBe('u1')
    expect(event.request?.data).toEqual({
      email: '[Redacted]',
      code: '[Redacted]'
    })
    expect(event.request?.headers?.authorization).toBe('[Redacted]')
    expect(event.extra).toEqual({
      to: '[Redacted]',
      user_email: '[Redacted]'
    })
  })

  it('redacts lemon billing shapes in extras', () => {
    const event = scrubSentryEvent({
      extra: {
        payload: {
          data: {
            attributes: {
              user_email: 'buyer@example.com',
              customer_id: 'cus_1',
              status: 'active'
            }
          }
        }
      }
    })

    expect(JSON.stringify(event)).not.toContain('buyer@example.com')
    expect(JSON.stringify(event)).not.toContain('cus_1')
  })
})
