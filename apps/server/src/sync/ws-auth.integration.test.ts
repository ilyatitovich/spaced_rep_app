import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { SignJWT } from 'jose'
import { WebSocket, type WebSocketServer } from 'ws'
import {
  PROTOCOL_VERSION,
  createEnvelopeId,
  decodeEnvelope,
  encodeEnvelope,
  type SyncEnvelope
} from '@spaced-rep/sync-protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getTestEnv } from '../../../../testing/config/env.js'
import { getTestPrisma } from '../../../../testing/db/prisma.js'
import { grantProPlan } from '../../../../testing/helpers/billing/grant-pro.js'
import {
  createSessionForUser,
  revokeSession,
  type AuthTokens
} from '../../../../testing/helpers/auth/session.js'
import { createSyncWss } from './ws.handler.js'

const EPOCH = '0'

class Client {
  readonly frames: SyncEnvelope[] = []
  closed: { code: number; reason: string } | null = null
  readonly deviceId = randomUUID()

  constructor(readonly ws: WebSocket) {
    ws.on('message', data => {
      this.frames.push(decodeEnvelope(data.toString()))
    })
    ws.on('close', (code, reason) => {
      this.closed = { code, reason: reason.toString() }
    })
  }

  async opened(): Promise<this> {
    if (this.ws.readyState !== WebSocket.OPEN) await once(this.ws, 'open')
    return this
  }

  /** Resolves once the server has closed the socket. */
  async close(): Promise<{ code: number; reason: string }> {
    return vi.waitFor(() => {
      if (this.closed === null) throw new Error('socket still open')
      return this.closed
    })
  }

  /** Resolves once the frame at `index` has arrived. */
  async frameAt(index: number): Promise<SyncEnvelope> {
    return vi.waitFor(() => {
      const frame = this.frames[index]
      if (frame === undefined) throw new Error(`no frame at index ${index}`)
      return frame
    })
  }

  kinds(): string[] {
    return this.frames.map(frame => frame.kind)
  }

  errorCodes(): string[] {
    return this.frames.flatMap(frame =>
      frame.kind === 'error' ? [frame.error.code] : []
    )
  }

  private base() {
    return {
      version: PROTOCOL_VERSION,
      messageId: createEnvelopeId(),
      deviceId: this.deviceId,
      sentAt: Date.now()
    }
  }

  sendHello(): void {
    this.ws.send(
      encodeEnvelope({
        ...this.base(),
        kind: 'hello',
        hello: {
          lastPulledAt: EPOCH,
          pendingOpCount: 0,
          protocolVersion: PROTOCOL_VERSION
        }
      })
    )
  }

  sendPull(): void {
    this.ws.send(
      encodeEnvelope({
        ...this.base(),
        kind: 'pullRequest',
        pullRequest: { since: EPOCH }
      })
    )
  }

  sendPush(): void {
    this.ws.send(
      encodeEnvelope({
        ...this.base(),
        kind: 'pushBatch',
        pushBatch: { mutations: [] }
      })
    )
  }
}

let server: Server
let wss: WebSocketServer
const clients: Client[] = []

function connect(options: {
  header?: string
  query?: string
}): Promise<Client> {
  const { port } = server.address() as AddressInfo
  const search = options.query === undefined ? '' : `?${options.query}`
  const ws = new WebSocket(`ws://127.0.0.1:${port}/sync/ws${search}`, {
    headers:
      options.header === undefined ? {} : { Authorization: options.header }
  })
  const client = new Client(ws)
  clients.push(client)
  return client.opened()
}

async function connectAs(tokens: AuthTokens): Promise<Client> {
  return connect({ header: `Bearer ${tokens.accessToken}` })
}

async function proUser(): Promise<AuthTokens> {
  const tokens = await createSessionForUser()
  await grantProPlan(tokens.user.id)
  return tokens
}

async function startServer(): Promise<void> {
  server = createServer()
  wss = createSyncWss(server)
  server.listen(0)
  await once(server, 'listening')
}

beforeEach(startServer)

afterEach(async () => {
  vi.useRealTimers()
  for (const client of clients.splice(0)) client.ws.terminate()
  wss.close()
  await new Promise<void>(resolve => server.close(() => resolve()))
})

/** What the server does to a connection it refuses: one error frame, then 4001. */
const REJECTED = {
  code: 4001,
  errors: ['TOKEN_EXPIRED'],
  kinds: ['error']
}

async function outcome(client: Client) {
  const { code } = await client.close()
  return { code, errors: client.errorCodes(), kinds: client.kinds() }
}

describe('ws upgrade: credentials', () => {
  it('accepts a bearer Authorization header', async () => {
    const client = await connectAs(await proUser())

    client.sendHello()

    expect((await client.frameAt(0)).kind).toBe('helloAck')
    expect(client.closed).toBeNull()
  })

  it('accepts the access_token query parameter', async () => {
    const tokens = await proUser()
    const client = await connect({
      query: `access_token=${tokens.accessToken}`
    })

    client.sendHello()

    expect((await client.frameAt(0)).kind).toBe('helloAck')
    expect(client.closed).toBeNull()
  })

  it('reports the authenticated session in helloAck', async () => {
    const tokens = await proUser()
    const client = await connect({
      query: `access_token=${tokens.accessToken}`
    })

    client.sendHello()

    const ack = await client.frameAt(0)
    const session = await getTestPrisma().session.findFirstOrThrow({
      where: { userId: tokens.user.id }
    })
    expect(ack.kind === 'helloAck' && ack.helloAck.sessionId).toBe(session.id)
  })

  it('rejects a connection with no credentials', async () => {
    expect(await outcome(await connect({}))).toEqual(REJECTED)
  })

  it('rejects an empty access_token parameter', async () => {
    expect(await outcome(await connect({ query: 'access_token=' }))).toEqual(
      REJECTED
    )
  })

  it('rejects a non-bearer Authorization header', async () => {
    const tokens = await proUser()
    expect(
      await outcome(await connect({ header: `Basic ${tokens.accessToken}` }))
    ).toEqual(REJECTED)
  })

  it('rejects a garbage access token', async () => {
    expect(
      await outcome(await connect({ query: 'access_token=not-a-jwt' }))
    ).toEqual(REJECTED)
    expect(await outcome(await connect({ header: 'Bearer a.b.c' }))).toEqual(
      REJECTED
    )
  })

  it('rejects a token signed with another secret', async () => {
    const tokens = await proUser()
    const session = await getTestPrisma().session.findFirstOrThrow({
      where: { userId: tokens.user.id }
    })
    const forged = await new SignJWT({ sid: session.id, typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(tokens.user.id)
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode(`${getTestEnv().jwtSecret}-other`))

    expect(
      await outcome(await connect({ query: `access_token=${forged}` }))
    ).toEqual(REJECTED)
  })

  it('rejects an expired access token', async () => {
    const tokens = await proUser()
    const session = await getTestPrisma().session.findFirstOrThrow({
      where: { userId: tokens.user.id }
    })
    const now = Math.floor(Date.now() / 1000)
    const expired = await new SignJWT({ sid: session.id, typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(tokens.user.id)
      .setIssuedAt(now - 3600)
      .setExpirationTime(now - 60)
      .sign(new TextEncoder().encode(getTestEnv().jwtSecret))

    expect(
      await outcome(await connect({ query: `access_token=${expired}` }))
    ).toEqual(REJECTED)
  })

  it('does not accept the refresh token as an access token', async () => {
    const tokens = await proUser()
    expect(
      await outcome(
        await connect({ query: `access_token=${tokens.refreshToken}` })
      )
    ).toEqual(REJECTED)
  })
})

describe('ws upgrade: session and account state', () => {
  it('rejects a revoked session', async () => {
    const tokens = await proUser()
    await revokeSession(tokens.accessToken)

    expect(await outcome(await connectAs(tokens))).toEqual(REJECTED)
  })

  it('rejects an expired session', async () => {
    const tokens = await proUser()
    await getTestPrisma().session.updateMany({
      where: { userId: tokens.user.id },
      data: { expiresAt: new Date(Date.now() - 1000) }
    })

    expect(await outcome(await connectAs(tokens))).toEqual(REJECTED)
  })

  it('rejects a token whose account was deleted', async () => {
    const tokens = await proUser()
    await getTestPrisma().user.delete({ where: { id: tokens.user.id } })

    expect(await outcome(await connectAs(tokens))).toEqual(REJECTED)
  })

  it('rejects a disabled account', async () => {
    const tokens = await proUser()
    await getTestPrisma().user.update({
      where: { id: tokens.user.id },
      data: { disabledAt: new Date() }
    })

    expect(await outcome(await connectAs(tokens))).toEqual(REJECTED)
  })

  it('does not reuse another session of the same user after revoking one', async () => {
    const first = await proUser()
    const second = await createSessionForUser({ userId: first.user.id })
    await revokeSession(first.accessToken)

    expect(await outcome(await connectAs(first))).toEqual(REJECTED)
    const client = await connectAs(second)
    client.sendHello()
    expect((await client.frameAt(0)).kind).toBe('helloAck')
  })
})

describe('ws while connected', () => {
  async function helloed(tokens: AuthTokens): Promise<Client> {
    const client = await connectAs(tokens)
    client.sendHello()
    expect((await client.frameAt(0)).kind).toBe('helloAck')
    return client
  }

  it('stops serving a session that is revoked (logout) mid-connection', async () => {
    const tokens = await proUser()
    const client = await helloed(tokens)

    await revokeSession(tokens.accessToken)
    client.sendPull()

    await client.close()
    expect(client.closed).toMatchObject({ code: 4001 })
    expect(client.errorCodes()).toEqual(['TOKEN_EXPIRED'])
    expect(client.kinds()).not.toContain('pullDelta')
  })

  it('refuses writes from a session revoked mid-connection', async () => {
    const tokens = await proUser()
    const client = await helloed(tokens)

    await revokeSession(tokens.accessToken)
    client.sendPush()

    await client.close()
    expect(client.closed).toMatchObject({ code: 4001 })
    expect(client.kinds()).not.toContain('pushAck')
  })

  it('stops serving a session that expires mid-connection', async () => {
    const tokens = await proUser()
    const client = await helloed(tokens)

    await getTestPrisma().session.updateMany({
      where: { userId: tokens.user.id },
      data: { expiresAt: new Date(Date.now() - 1000) }
    })
    client.sendPull()

    expect(await client.close()).toMatchObject({ code: 4001 })
    expect(client.kinds()).not.toContain('pullDelta')
  })

  it('closes with 4001 (not a plan error) when the account is deleted mid-connection', async () => {
    const tokens = await proUser()
    const client = await helloed(tokens)

    await getTestPrisma().user.delete({ where: { id: tokens.user.id } })
    client.sendPull()

    expect(await client.close()).toMatchObject({ code: 4001 })
    expect(client.errorCodes()).toEqual(['TOKEN_EXPIRED'])
    expect(client.kinds()).not.toContain('pullDelta')
  })

  it('stops serving an account that is disabled mid-connection', async () => {
    const tokens = await proUser()
    const client = await helloed(tokens)

    await getTestPrisma().user.update({
      where: { id: tokens.user.id },
      data: { disabledAt: new Date() }
    })
    client.sendPull()

    expect(await client.close()).toMatchObject({ code: 4001 })
    expect(client.kinds()).not.toContain('pullDelta')
  })

  it('keeps serving the user other sessions when one is revoked', async () => {
    const first = await proUser()
    const second = await createSessionForUser({ userId: first.user.id })
    const firstClient = await helloed(first)
    const secondClient = await helloed(second)

    await revokeSession(first.accessToken)
    firstClient.sendPull()
    secondClient.sendPull()

    expect(await firstClient.close()).toMatchObject({ code: 4001 })
    expect((await secondClient.frameAt(1)).kind).toBe('pullDelta')
    expect(secondClient.closed).toBeNull()
  })

  it('drops an idle connection on the next heartbeat after logout', async () => {
    wss.close()
    await new Promise<void>(resolve => server.close(() => resolve()))
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    await startServer()
    const tokens = await proUser()
    const client = await helloed(tokens)

    await revokeSession(tokens.accessToken)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(await client.close()).toMatchObject({ code: 4001 })
    expect(client.kinds()).not.toContain('ping')
  })

  it('keeps pinging a healthy connection on the heartbeat', async () => {
    wss.close()
    await new Promise<void>(resolve => server.close(() => resolve()))
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    await startServer()
    const client = await helloed(await proUser())

    await vi.advanceTimersByTimeAsync(30_000)

    expect((await client.frameAt(1)).kind).toBe('ping')
    expect(client.closed).toBeNull()
  })
})
