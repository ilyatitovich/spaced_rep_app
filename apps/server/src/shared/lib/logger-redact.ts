/** Paths pino strips from every log line (logger + pino-http). */
export const LOG_REDACT_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
  'res.headers["set-cookie"]',
  // Email OTP / account identifiers
  'email',
  'to',
  '*.email',
  '*.to',
  'req.body.email',
  'user.email',
  // Lemon Squeezy webhook payloads (and anything else that reuses the shapes)
  'req.body.data',
  'req.body.meta',
  '*.user_email',
  '*.customer_email',
  '*.customer_id',
  'data.attributes.user_email',
  'data.attributes.customer_id',
  'meta.custom_data'
]
