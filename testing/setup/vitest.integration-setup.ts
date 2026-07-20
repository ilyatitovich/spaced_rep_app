import { afterAll, beforeEach } from 'vitest'
import { loadTestEnv } from '../config/env.js'
import { disconnectTestPrisma } from '../db/prisma.js'
import { resetTestDatabase } from '../db/reset.js'
import { prepareTestRun } from '../db/seed.js'
import { flushTestRedis } from '../redis/flush.js'

loadTestEnv()

beforeEach(async () => {
  prepareTestRun()
  await resetTestDatabase()
  await flushTestRedis()
})

afterAll(async () => {
  await disconnectTestPrisma()
})
