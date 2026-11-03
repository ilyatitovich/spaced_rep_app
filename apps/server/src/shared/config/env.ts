import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { envSchema } from './env-schema.js'
import { productionEnvIssues } from './production-env.js'

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)
dotenv.config({ path: path.join(rootDir, '.env') })
// CI / fresh clones have no apps/server/src/.env — fall back to committed test stubs.
// Never in production: a missing DATABASE_URL must fail loudly, not boot on stubs.
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
  dotenv.config({
    path: path.resolve(rootDir, '../../../.env.test.example')
  })
}

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error(
    'Invalid environment variables:',
    parsed.error.flatten().fieldErrors
  )
  process.exit(1)
}

const productionIssues = productionEnvIssues(parsed.data)
if (productionIssues.length > 0) {
  console.error('Unsafe production environment:', productionIssues)
  process.exit(1)
}

export const env = parsed.data
