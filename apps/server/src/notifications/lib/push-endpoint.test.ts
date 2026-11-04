import { describe, expect, it } from 'vitest'

import { isPushEndpointAllowed } from './push-endpoint.js'

describe('isPushEndpointAllowed', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/xxx',
    'https://push.services.mozilla.com/wpush/v2/xxx',
    'https://web.push.apple.com/xxx',
    'https://push.apple.com/xxx',
    'https://wns2-bn1p.notify.windows.com/w/?token=abc'
  ])('allows %s', endpoint => {
    expect(isPushEndpointAllowed(endpoint)).toBe(true)
  })

  it.each([
    ['http://fcm.googleapis.com/fcm/send/abc', 'non-https'],
    ['https://evil.example.com/push', 'unknown host'],
    ['https://fcm.googleapis.com.evil.com/x', 'suffix spoof'],
    ['https://127.0.0.1/push', 'loopback'],
    ['https://10.0.0.5/push', 'private IP'],
    ['https://169.254.169.254/latest', 'link-local metadata'],
    ['https://localhost/push', 'localhost'],
    ['not-a-url', 'malformed']
  ])('rejects %s (%s)', (endpoint, _reason) => {
    expect(isPushEndpointAllowed(endpoint)).toBe(false)
  })
})
