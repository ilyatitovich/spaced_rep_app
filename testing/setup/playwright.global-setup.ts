import { loadTestEnv } from '../config/env.js'
import { migrateTestDatabase } from '../db/migrate.js'

export default async function globalSetup(): Promise<void> {
  loadTestEnv()
  migrateTestDatabase()
}
