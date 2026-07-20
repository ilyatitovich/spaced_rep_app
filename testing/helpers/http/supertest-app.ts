import request from 'supertest'
import { loadTestEnv } from '../../config/env.js'

type TestApp = Parameters<typeof request>[0]

let app: TestApp | null = null

async function getTestApp(): Promise<TestApp> {
  if (!app) {
    loadTestEnv()
    const { createApp } = await import('../../../apps/server/src/app.js')
    app = createApp()
  }
  return app
}

export async function createTestAgent(): Promise<ReturnType<typeof request>> {
  return request(await getTestApp())
}

export async function resetTestApp(): Promise<void> {
  app = null
}
