import { cancelLemonSubscription } from '../../settings/billing/lemon-squeezy.js'
import { NotFoundError } from '../../shared/lib/errors.js'
import { logger } from '../../shared/lib/logger.js'
import { prisma } from '../../shared/lib/prisma.js'
import {
  createR2StorageFromEnv,
  isR2Configured,
  type R2Storage
} from '../../shared/lib/r2-storage.js'

let storageOverride: R2Storage | null = null
let billingCancelOverride: ((subscriptionId: string) => Promise<void>) | null =
  null

/** Test seam — inject a mock R2/S3 store for prefix deletes. */
export function setAccountMediaStorageForTests(
  storage: R2Storage | null
): void {
  storageOverride = storage
}

/** Test seam — inject Lemon cancel (or null to use the real client). */
export function setAccountBillingCancelForTests(
  cancel: ((subscriptionId: string) => Promise<void>) | null
): void {
  billingCancelOverride = cancel
}

async function deleteUserMediaPrefix(userId: string): Promise<void> {
  if (!storageOverride && !isR2Configured()) return
  const storage = storageOverride ?? createR2StorageFromEnv()
  await storage.deletePrefix(`${userId}/`)
}

async function cancelProviderSubscription(
  providerSubscriptionId: string
): Promise<void> {
  const cancel = billingCancelOverride ?? cancelLemonSubscription
  try {
    await cancel(providerSubscriptionId)
  } catch (err) {
    logger.warn(
      { err, providerSubscriptionId },
      'Lemon cancel during account delete failed; continuing cleanup'
    )
  }
}

export async function deleteAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      subscription: { select: { providerSubscriptionId: true } }
    }
  })
  if (!user) {
    throw new NotFoundError('Account not found')
  }

  const providerSubscriptionId = user.subscription?.providerSubscriptionId
  if (providerSubscriptionId) {
    await cancelProviderSubscription(providerSubscriptionId)
  }

  await deleteUserMediaPrefix(userId)
  await prisma.user.delete({ where: { id: userId } })
}
