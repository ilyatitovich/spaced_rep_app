/** Cloudflare Turnstile always-pass / always-fail / force-interactive test secrets. */
export const TURNSTILE_TEST_SECRETS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA'
])

const DEV_SECRET_MARKERS = ['dev-only', 'change-me']

export interface ProductionEnvSnapshot {
  NODE_ENV: string
  CORS_ORIGIN: string[]
  JWT_SECRET: string
  OTP_PEPPER: string
  TURNSTILE_SECRET_KEY: string
}

function looksLikeDevSecret(value: string): boolean {
  const lower = value.toLowerCase()
  return DEV_SECRET_MARKERS.some(marker => lower.includes(marker))
}

/** Returns human-readable issues; empty when production config is acceptable. */
export function productionEnvIssues(data: ProductionEnvSnapshot): string[] {
  if (data.NODE_ENV !== 'production') return []

  const issues: string[] = []
  if (data.CORS_ORIGIN.includes('*')) {
    issues.push('CORS_ORIGIN must not include * in production')
  }
  if (looksLikeDevSecret(data.JWT_SECRET)) {
    issues.push('JWT_SECRET looks like a development placeholder')
  }
  if (looksLikeDevSecret(data.OTP_PEPPER)) {
    issues.push('OTP_PEPPER looks like a development placeholder')
  }
  if (TURNSTILE_TEST_SECRETS.has(data.TURNSTILE_SECRET_KEY)) {
    issues.push('TURNSTILE_SECRET_KEY must not be a Cloudflare test secret')
  }
  return issues
}
