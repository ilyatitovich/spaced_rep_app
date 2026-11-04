const REDACT = '[Redacted]'
const SENSITIVE_KEYS = new Set([
  'email',
  'to',
  'user_email',
  'customer_email',
  'customer_id',
  'authorization',
  'cookie',
  'password',
  'otp',
  'code',
  'token',
  'access_token',
  'refresh_token'
])

export interface ScrubbableSentryEvent {
  user?: Record<string, unknown>
  request?: {
    data?: unknown
    headers?: Record<string, unknown>
    [key: string]: unknown
  }
  extra?: Record<string, unknown>
  [key: string]: unknown
}

function scrubValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key.toLowerCase())) return REDACT
  if (Array.isArray(value)) return value.map(item => scrubUnknown(item))
  if (value && typeof value === 'object') {
    return scrubRecord(value as Record<string, unknown>)
  }
  return value
}

function scrubRecord(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    out[key] = scrubValue(key, value)
  }
  return out
}

function scrubUnknown(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubUnknown)
  if (value && typeof value === 'object') {
    return scrubRecord(value as Record<string, unknown>)
  }
  return value
}

/** Drop emails, tokens, and billing identifiers before an event leaves the process. */
export function scrubSentryEvent<T extends ScrubbableSentryEvent>(event: T): T {
  const next = { ...event } as T

  if (next.user) {
    const user = { ...next.user }
    delete user.email
    delete user.ip_address
    next.user = user
  }

  if (next.request) {
    const request = { ...next.request }
    if (request.data && typeof request.data === 'object') {
      request.data = scrubUnknown(request.data)
    }
    if (request.headers && typeof request.headers === 'object') {
      request.headers = scrubUnknown(request.headers) as Record<string, unknown>
    }
    next.request = request
  }

  if (next.extra) {
    next.extra = scrubUnknown(next.extra) as Record<string, unknown>
  }

  return next
}
