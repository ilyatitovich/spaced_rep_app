import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./shared/lib/health.js', () => ({
  checkLiveness: vi.fn(async () => ({ status: 'ok' })),
  checkReadiness: vi.fn(async () => ({
    status: 'ok',
    postgres: 'up',
    redis: 'up'
  }))
}))

vi.mock('./shared/lib/metrics.js', () => ({
  renderPrometheusMetrics: () =>
    [
      'sync_push_latency_ms_count 0',
      'sync_pull_page_size_count 0',
      'sync_ws_connections 0',
      ''
    ].join('\n')
}))

const { createApp } = await import('./app.js')
const { checkLiveness, checkReadiness } = await import('./shared/lib/health.js')

describe('observability routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /live does not probe dependencies', async () => {
    const res = await request(createApp()).get('/live')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
    expect(checkLiveness).toHaveBeenCalled()
    expect(checkReadiness).not.toHaveBeenCalled()
  })

  it('GET /ready and /health share the dependency probe', async () => {
    const app = createApp()
    const ready = await request(app).get('/ready')
    const health = await request(app).get('/health')

    expect(ready.status).toBe(200)
    expect(health.status).toBe(200)
    expect(ready.body).toEqual(health.body)
    expect(checkReadiness).toHaveBeenCalledTimes(2)
  })

  it('GET /metrics returns prometheus text', async () => {
    const res = await request(createApp()).get('/metrics')
    expect(res.status).toBe(200)
    expect(res.text).toContain('sync_ws_connections 0')
  })
})
