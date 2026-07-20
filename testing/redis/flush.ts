import { createClient } from 'redis'
import { getTestEnv, loadTestEnv } from '../config/env.js'

export async function flushTestRedis(): Promise<void> {
  loadTestEnv()
  const { redisUrl } = getTestEnv()
  const client = createClient({ url: redisUrl })

  client.on('error', () => {
    // Swallow — caller gets the connection error on connect/flush.
  })

  await client.connect()
  await client.flushDb()
  await client.quit()
}
