import { createTestAgent } from '../../../testing/helpers/http/supertest-app.js'

describe('GET /health', () => {
  it('returns 200 with postgres and redis up', async () => {
    const agent = await createTestAgent()
    const res = await agent.get('/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      status: 'ok',
      postgres: 'up',
      redis: 'up'
    })
    expect(res.headers['x-request-id']).toEqual(expect.any(String))
  })
})
