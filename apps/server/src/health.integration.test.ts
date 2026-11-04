import { createTestAgent } from '../../../testing/helpers/http/supertest-app.js'

describe('health endpoints', () => {
  it('GET /live returns 200 without dependency details', async () => {
    const agent = await createTestAgent()
    const res = await agent.get('/live')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
    expect(res.headers['x-request-id']).toEqual(expect.any(String))
  })

  it('GET /ready returns 200 with postgres and redis up', async () => {
    const agent = await createTestAgent()
    const res = await agent.get('/ready')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      status: 'ok',
      postgres: 'up',
      redis: 'up'
    })
  })

  it('GET /health stays an alias of /ready', async () => {
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
