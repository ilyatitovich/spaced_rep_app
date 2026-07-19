import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { defineConfig } from 'prisma/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// Prefer compose/CI-injected env; fall back to the server app env file for local CLI.
dotenv.config({ path: path.join(rootDir, 'src/.env') })

// `prisma generate` does not connect to the DB. Allow builds (Docker/CI) without
// a real DATABASE_URL; migrate/studio/runtime still need a valid one.
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://prisma:prisma@localhost:5432/prisma?schema=public'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations'
  },
  datasource: {
    url: databaseUrl
  }
})
