import request from 'supertest'
import { loadTestEnv } from '../../config/env.js'

let app = null

async function getTestApp() {
  if (!app) {
    loadTestEnv()
    const { createApp } = await import('../../../apps/server/src/app.js')
    app = createApp()
  }
  return app
}

export async function createTestAgent() {
  return request(await getTestApp())
}

export async function resetTestApp() {
  app = null
}
