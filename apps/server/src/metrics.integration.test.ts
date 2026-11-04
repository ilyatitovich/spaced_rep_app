import { createTestAgent } from '../../../testing/helpers/http/supertest-app.js'

describe('GET /metrics', () => {
  it('returns prometheus text with sync gauges', async () => {
    const agent = await createTestAgent()
    const res = await agent.get('/metrics')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/plain/)
    expect(res.text).toContain('sync_push_latency_ms_count')
    expect(res.text).toContain('sync_pull_page_size_count')
    expect(res.text).toContain('sync_ws_connections')
  })
})
