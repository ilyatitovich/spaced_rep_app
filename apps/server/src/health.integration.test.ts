import { createTestAgent } from '../../../testing/helpers/http/supertest-app.js'

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const agent = await createTestAgent()
    const res = await agent.get('/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
