import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}))

const { errorHandler } = await import('./error-handler.js')
const { BadRequestError } = await import('../lib/errors.js')

/** Same parser order as `createApp`, with a tiny limit so the test stays small. */
function appWithParser() {
  const app = express()
  app.use(express.json({ limit: '1kb' }))
  app.post('/echo', (req, res) => {
    res.json({ data: req.body })
  })
  app.get('/boom', () => {
    throw new Error('database password is hunter2')
  })
  app.get('/app-error', () => {
    throw new BadRequestError('nope', 'NOPE')
  })
  app.use(errorHandler)
  return app
}

describe('errorHandler body-parser errors', () => {
  it('maps an oversized body to 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await request(appWithParser())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ pad: 'x'.repeat(2_000) }))

    expect(res.status).toBe(413)
    expect(res.body).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body is too large'
      }
    })
  })

  it('maps malformed JSON to 400 INVALID_JSON', async () => {
    const res = await request(appWithParser())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"truncated":')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({
      error: {
        code: 'INVALID_JSON',
        message: 'Request body is not valid JSON'
      }
    })
  })

  it('does not echo the parser message or the offending body', async () => {
    const res = await request(appWithParser())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"secret": nope}')

    expect(JSON.stringify(res.body)).not.toContain('secret')
  })

  it('maps an unsupported content encoding to a 4xx, not a 500', async () => {
    const res = await request(appWithParser())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'bogus')
      .send('{}')

    expect(res.status).toBe(415)
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE')
  })
})

describe('errorHandler other errors', () => {
  it('keeps AppError status and code', async () => {
    const res = await request(appWithParser()).get('/app-error')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: { code: 'NOPE', message: 'nope' } })
  })

  it('still answers 500 for unexpected errors', async () => {
    const res = await request(appWithParser()).get('/boom')
    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('INTERNAL_ERROR')
  })
})
