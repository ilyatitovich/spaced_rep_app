import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../apps/server/src/generated/prisma/client.js'
import { getTestEnv, loadTestEnv } from '../config/env.js'

let client: PrismaClient | null = null

export function getTestPrisma(): PrismaClient {
  if (!client) {
    loadTestEnv()
    const { databaseUrl } = getTestEnv()
    const adapter = new PrismaPg({ connectionString: databaseUrl })
    client = new PrismaClient({ adapter, log: ['error'] })
  }
  return client
}

export async function disconnectTestPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect()
    client = null
  }
}

export type { PrismaClient } from '../../apps/server/src/generated/prisma/client.js'
