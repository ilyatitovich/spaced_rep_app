import { enforceRateLimit } from '../shared/lib/redis.js'

/** One budget per user, shared by HTTP and WebSocket pushes. */
export function enforcePushRateLimit(userId: string): Promise<void> {
  return enforceRateLimit({
    key: `sync:push:${userId}`,
    // Burst drain after sign-in can need many batches (50 ops each).
    limit: 500,
    windowSeconds: 60,
    message: 'Sync rate limit exceeded'
  })
}
