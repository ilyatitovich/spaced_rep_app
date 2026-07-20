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
  CORS_ORIGIN: z.string().default('*'),
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
  WEBAUTHN_CHALLENGE_TTL_SECONDS: z.coerce.number().int().positive().default(60)
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
