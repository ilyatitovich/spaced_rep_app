import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { z } from 'zod'

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)
dotenv.config({ path: path.join(rootDir, '.env') })

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  CORS_ORIGIN: z
    .string()
    .default('*')
    .transform(value => value.split(',').map(origin => origin.trim())),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_REDIRECT_URIS: z
    .string()
    .min(1, 'GOOGLE_REDIRECT_URIS is required')
    .transform(value =>
      value
        .split(',')
        .map(uri => uri.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.string().url()).min(1)),
  EXTENSION_REDIRECT_URIS: z
    .string()
    .default('')
    .transform(value =>
      value
        .split(',')
        .map(uri => uri.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.string().url())),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 30),
  SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 30),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  OTP_PEPPER: z.string().min(32, 'OTP_PEPPER must be at least 32 characters'),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  TURNSTILE_SECRET_KEY: z.string().min(1, 'TURNSTILE_SECRET_KEY is required'),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  EMAIL_FROM: z.string().min(1, 'EMAIL_FROM is required'),
  WEBAUTHN_RP_ID: z.string().min(1, 'WEBAUTHN_RP_ID is required'),
  WEBAUTHN_RP_NAME: z.string().min(1, 'WEBAUTHN_RP_NAME is required'),
  WEBAUTHN_ORIGIN: z
    .string()
    .min(1, 'WEBAUTHN_ORIGIN is required')
    .transform(value =>
      value
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.string().url()).min(1)),
  WEBAUTHN_CHALLENGE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
  VAPID_PUBLIC_KEY: z.string().min(1, 'VAPID_PUBLIC_KEY is required'),
  VAPID_PRIVATE_KEY: z.string().min(1, 'VAPID_PRIVATE_KEY is required'),
  VAPID_SUBJECT: z
    .string()
    .min(1, 'VAPID_SUBJECT is required')
    .refine(
      value => value.startsWith('mailto:') || value.startsWith('https://'),
      'VAPID_SUBJECT must be a mailto: or https: URL'
    ),
  LEMONSQUEEZY_API_KEY: z.string().default(''),
  LEMONSQUEEZY_WEBHOOK_SECRET: z.string().default(''),
  LEMONSQUEEZY_STORE_ID: z.string().default(''),
  LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID: z.string().default(''),
  LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID: z.string().default(''),
  LEMONSQUEEZY_TEST_MODE: z
    .string()
    .default('false')
    .transform(value => value === 'true'),
  BILLING_RETURN_URL: z.string().default(''),
  // Private R2 (prod) or MinIO (local). Tests may omit credentials and inject a mock.
  R2_ACCOUNT_ID: z.string().default(''),
  R2_BUCKET: z.string().default('spaced-rep-media'),
  R2_ACCESS_KEY_ID: z.string().default(''),
  R2_SECRET_ACCESS_KEY: z.string().default(''),
  /** API endpoint override (MinIO `http://minio:9000`). Empty → derive from R2_ACCOUNT_ID. */
  R2_ENDPOINT: z.string().default(''),
  /** Browser-reachable endpoint for presigned URLs (MinIO `http://localhost:9000`). */
  R2_PRESIGN_ENDPOINT: z.string().default(''),
  R2_REGION: z.string().default('auto'),
  R2_FORCE_PATH_STYLE: z
    .string()
    .default('false')
    .transform(value => value === 'true')
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error(
    'Invalid environment variables:',
    parsed.error.flatten().fieldErrors
  )
  process.exit(1)
}

export const env = parsed.data
