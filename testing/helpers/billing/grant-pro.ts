import { getTestPrisma } from '../../db/prisma.js'

/** Mark a user as Pro so client sync entitlement and device slots engage. */
export async function grantProPlan(userId: string): Promise<void> {
  const prisma = getTestPrisma()
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: 'PRO',
      status: 'ACTIVE',
      provider: 'NONE'
    },
    update: {
      plan: 'PRO',
      status: 'ACTIVE',
      endsAt: null,
      canceledAt: null,
      cancelAtPeriodEnd: false
    }
  })
}
