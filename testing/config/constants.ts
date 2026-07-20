export const TEST_PORTS = {
  server: 3000,
  client: 5173,
  postgres: 5433,
  redis: 6380
} as const

export const TEST_TIMEOUTS = {
  integrationMs: 30_000,
  e2eMs: 60_000
} as const

export const OTP_REDIS_KEY_PREFIX = 'otp:dev:'

export const WEBAUTHN_TEST_RP_ID = 'localhost'

export const FAKER_SEED = 42

export const TEST_TABLES = [
  'notification_reminders',
  'user_notification_settings',
  'user_learning_settings',
  'user_preferences',
  'subscriptions',
  'security_events',
  'oauth_identities',
  'auth_challenges',
  'passkeys',
  'otp_codes',
  'refresh_tokens',
  'sessions',
  'sync_operations',
  'sync_devices',
  'cards',
  'topics',
  'users'
] as const
