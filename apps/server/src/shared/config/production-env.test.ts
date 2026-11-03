import { describe, expect, it } from 'vitest'
import { productionEnvIssues } from './production-env.js'

const safe = {
  NODE_ENV: 'production',
  CORS_ORIGIN: ['https://app.example.com'],
  JWT_SECRET: 'a'.repeat(32),
  OTP_PEPPER: 'b'.repeat(32),
  TURNSTILE_SECRET_KEY: 'real-turnstile-secret-not-a-test-key'
}

describe('productionEnvIssues', () => {
  it('ignores non-production', () => {
    expect(productionEnvIssues({ ...safe, NODE_ENV: 'development' })).toEqual(
      []
    )
  })

  it('accepts a safe production snapshot', () => {
    expect(productionEnvIssues(safe)).toEqual([])
  })

  it('rejects CORS_ORIGIN=*', () => {
    expect(productionEnvIssues({ ...safe, CORS_ORIGIN: ['*'] })).toContain(
      'CORS_ORIGIN must not include * in production'
    )
  })

  it('rejects example JWT and OTP peppers', () => {
    const issues = productionEnvIssues({
      ...safe,
      JWT_SECRET: 'dev-only-change-me-to-a-long-random-secret',
      OTP_PEPPER: 'dev-only-change-me-to-a-long-otp-pepper'
    })
    expect(issues).toEqual(
      expect.arrayContaining([
        'JWT_SECRET looks like a development placeholder',
        'OTP_PEPPER looks like a development placeholder'
      ])
    )
  })

  it('rejects Turnstile test secrets', () => {
    expect(
      productionEnvIssues({
        ...safe,
        TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA'
      })
    ).toContain('TURNSTILE_SECRET_KEY must not be a Cloudflare test secret')
  })
})
