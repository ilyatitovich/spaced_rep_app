import { NotFoundError } from '../../shared/lib/errors.js'
import { prisma } from '../../shared/lib/prisma.js'
import {
  createR2StorageFromEnv,
  isR2Configured,
  type R2Storage
} from '../../shared/lib/r2-storage.js'

let storageOverride: R2Storage | null = null

/** Test seam — inject a mock R2/S3 store for prefix deletes. */
export function setAccountMediaStorageForTests(
  storage: R2Storage | null
): void {
  storageOverride = storage
}

async function deleteUserMediaPrefix(userId: string): Promise<void> {
  if (!storageOverride && !isR2Configured()) return
  const storage = storageOverride ?? createR2StorageFromEnv()
  await storage.deletePrefix(`${userId}/`)
}

export async function deleteAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  })
  if (!user) {
    throw new NotFoundError('Account not found')
  }

  await prisma.user.delete({ where: { id: userId } })
  await deleteUserMediaPrefix(userId)
}
