import { TEST_TABLES } from '../config/constants.js'
import { getTestPrisma } from './prisma.js'

export async function resetTestDatabase(): Promise<void> {
  const prisma = getTestPrisma()
  const tableList = TEST_TABLES.map(table => `"${table}"`).join(', ')

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`
  )
}
