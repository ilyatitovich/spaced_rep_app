import { loadTestEnv } from '../config/env.js'
import { migrateTestDatabase } from '../db/migrate.js'

loadTestEnv()
migrateTestDatabase()
console.log('Test database migrated successfully.')
