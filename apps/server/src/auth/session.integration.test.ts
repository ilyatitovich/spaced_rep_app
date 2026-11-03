import { describe, expect, it } from 'vitest'

import { getTestPrisma } from '../../../../testing/db/prisma.js'
import {
  createSessionForUser,
  refreshTokens,
  revokeSession
} from '../../../../testing/helpers/auth/session.js'
import { createTestAgent } from '../../../../testing/helpers/http/supertest-app.js'

async function callMe(accessToken: string) {
  const agent = await createTestAgent()
  return agent.get('/auth/me').set('Authorization', `Bearer ${accessToken}`)
}

async function callRefresh(refreshToken: string) {
  const agent = await createTestAgent()
  return agent.post('/auth/token/refresh').send({ refreshToken })
}

async function callLogout(accessToken: string) {
  const agent = await createTestAgent()
  return agent
    .post('/auth/logout')
    .set('Authorization', `Bearer ${accessToken}`)
}

async function sessionOf(userId: string) {
  return getTestPrisma().session.findFirstOrThrow({ where: { userId } })
}

async function eventTypes(sessionId: string) {
  const events = await getTestPrisma().securityEvent.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    select: { type: true }
  })
  return events.map(e => e.type)
}

describe('logout', () => {
  it('invalidates the access token immediately', async () => {
    const tokens = await createSessionForUser()
    expect((await callMe(tokens.accessToken)).status).toBe(200)

    await revokeSession(tokens.accessToken)

    const res = await callMe(tokens.accessToken)
    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('UNAUTHORIZED')
  })

  it('is safe to repeat: the second call is rejected and nothing is double-logged', async () => {
    const tokens = await createSessionForUser()
    const session = await sessionOf(tokens.user.id)

    expect((await callLogout(tokens.accessToken)).status).toBe(200)
    expect((await callLogout(tokens.accessToken)).status).toBe(401)

    const revokedEvents = (await eventTypes(session.id)).filter(
      type => type === 'SESSION_REVOKED'
    )
    expect(revokedEvents).toHaveLength(1)
  })

  it('does not affect another session of the same user', async () => {
    const first = await createSessionForUser()
    const second = await createSessionForUser({ userId: first.user.id })

    await revokeSession(first.accessToken)

    expect((await callMe(first.accessToken)).status).toBe(401)
    expect((await callMe(second.accessToken)).status).toBe(200)
    expect((await callRefresh(second.refreshToken)).status).toBe(200)
  })

  it('revokes the refresh token of the logged-out session', async () => {
    const tokens = await createSessionForUser()
    await revokeSession(tokens.accessToken)

    const res = await callRefresh(tokens.refreshToken)
    expect(res.status).toBe(401)
  })

  // Logout revokes the refresh token without rotating it, so replaying it is
  // a plain rejection. It must not be reported as token theft: no
  // REFRESH_REUSE code and no REFRESH_REUSE_DETECTED security event.
  it('refresh after logout is a plain 401, not reuse detection', async () => {
    const tokens = await createSessionForUser()
    const session = await sessionOf(tokens.user.id)
    await revokeSession(tokens.accessToken)

    const res = await callRefresh(tokens.refreshToken)

    expect(res.status).toBe(401)
    expect(res.body.error?.code).not.toBe('REFRESH_REUSE')
    expect(await eventTypes(session.id)).not.toContain('REFRESH_REUSE_DETECTED')
  })
})

describe('refresh failures', () => {
  it('rejects an unknown refresh token', async () => {
    const res = await callRefresh('not-a-real-refresh-token')
    expect(res.status).toBe(401)
  })

  it('rejects a request without a refresh token', async () => {
    const res = await callRefresh('')
    expect(res.status).toBe(400)
  })

  it('rejects an expired refresh token', async () => {
    const tokens = await createSessionForUser()
    const session = await sessionOf(tokens.user.id)
    await getTestPrisma().refreshToken.updateMany({
      where: { sessionId: session.id },
      data: { expiresAt: new Date(Date.now() - 1000) }
    })

    const res = await callRefresh(tokens.refreshToken)
    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('UNAUTHORIZED')
  })

  it('rejects a refresh token whose session was revoked', async () => {
    const tokens = await createSessionForUser()
    await getTestPrisma().session.updateMany({
      where: { userId: tokens.user.id },
      data: { revokedAt: new Date() }
    })

    const res = await callRefresh(tokens.refreshToken)
    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('UNAUTHORIZED')
  })

  it('rejects a refresh token whose session has expired', async () => {
    const tokens = await createSessionForUser()
    await getTestPrisma().session.updateMany({
      where: { userId: tokens.user.id },
      data: { expiresAt: new Date(Date.now() - 1000) }
    })

    const res = await callRefresh(tokens.refreshToken)
    expect(res.status).toBe(401)
  })

  it('rejects a refresh for a disabled user', async () => {
    const tokens = await createSessionForUser()
    await getTestPrisma().user.update({
      where: { id: tokens.user.id },
      data: { disabledAt: new Date() }
    })

    const res = await callRefresh(tokens.refreshToken)
    expect(res.status).toBe(403)
    expect(res.body.error?.code).toBe('FORBIDDEN')
  })
})

describe('refresh rotation', () => {
  it('issues a new refresh token and keeps the same session', async () => {
    const first = await createSessionForUser()
    const session = await sessionOf(first.user.id)

    const rotated = await refreshTokens(first.refreshToken)

    expect(rotated.refreshToken).not.toBe(first.refreshToken)
    expect((await callMe(rotated.accessToken)).status).toBe(200)
    expect(
      await getTestPrisma().session.count({ where: { userId: first.user.id } })
    ).toBe(1)
    expect((await sessionOf(first.user.id)).id).toBe(session.id)
  })

  // Calls the service directly: through supertest the requests are
  // effectively serialized and never race. Rotation is a compare-and-swap, so
  // exactly one caller wins; the losers are handled like a replayed token.
  it('lets exactly one of many parallel rotations succeed', async () => {
    const { rotateRefreshToken } = await import('./services/session.service.js')
    const tokens = await createSessionForUser()
    const session = await sessionOf(tokens.user.id)

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => rotateRefreshToken(tokens.refreshToken))
    )

    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)

    const rejected = results.filter(r => r.status === 'rejected')
    expect(rejected).toHaveLength(4)
    for (const r of rejected) {
      expect(r.reason).toMatchObject({ code: 'REFRESH_REUSE' })
    }

    // The session never forks: no token is left alive, and every loser is
    // recorded as reuse.
    const liveTokens = await getTestPrisma().refreshToken.count({
      where: { sessionId: session.id, revokedAt: null }
    })
    expect(liveTokens).toBe(0)
    expect(
      (await eventTypes(session.id)).filter(t => t === 'REFRESH_REUSE_DETECTED')
    ).toHaveLength(4)
  })
})

describe('session security events', () => {
  it('records SESSION_CREATED, REFRESH_SUCCEEDED and SESSION_REVOKED in order', async () => {
    const tokens = await createSessionForUser()
    const session = await sessionOf(tokens.user.id)

    expect(await eventTypes(session.id)).toEqual(['SESSION_CREATED'])

    const rotated = await refreshTokens(tokens.refreshToken)
    expect(await eventTypes(session.id)).toEqual([
      'SESSION_CREATED',
      'REFRESH_SUCCEEDED'
    ])

    await revokeSession(rotated.accessToken)
    expect(await eventTypes(session.id)).toEqual([
      'SESSION_CREATED',
      'REFRESH_SUCCEEDED',
      'SESSION_REVOKED'
    ])
  })

  it('a rotated token whose session was already revoked by reuse stays a plain 401', async () => {
    const first = await createSessionForUser()
    const session = await sessionOf(first.user.id)
    const rotated = await refreshTokens(first.refreshToken)

    // Replay detects reuse and revokes the whole session...
    expect((await callRefresh(first.refreshToken)).body.error?.code).toBe(
      'REFRESH_REUSE'
    )
    // ...so the newest token is dead, but is not a second theft report.
    const res = await callRefresh(rotated.refreshToken)
    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('UNAUTHORIZED')
    expect(
      (await eventTypes(session.id)).filter(t => t === 'REFRESH_REUSE_DETECTED')
    ).toHaveLength(1)
  })

  it('records REFRESH_REUSE_DETECTED when a rotated token is replayed', async () => {
    const first = await createSessionForUser()
    const session = await sessionOf(first.user.id)
    await refreshTokens(first.refreshToken)

    expect((await callRefresh(first.refreshToken)).status).toBe(401)

    expect(await eventTypes(session.id)).toContain('REFRESH_REUSE_DETECTED')
  })
})
