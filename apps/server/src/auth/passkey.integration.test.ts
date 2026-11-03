import { describe, expect, it } from 'vitest'

import { getTestPrisma } from '../../../../testing/db/prisma.js'
import {
  createSessionForUser,
  type AuthTokens
} from '../../../../testing/helpers/auth/session.js'
import { createTestAgent } from '../../../../testing/helpers/http/supertest-app.js'
import {
  SoftwareAuthenticator,
  type AssertionOverrides,
  type CeremonyOverrides
} from '../../../../testing/helpers/webauthn/software-authenticator.js'

const bearer = (tokens: AuthTokens) => `Bearer ${tokens.accessToken}`

async function registerOptions(tokens: AuthTokens) {
  const agent = await createTestAgent()
  return agent
    .post('/auth/passkeys/register/options')
    .set('Authorization', bearer(tokens))
    .send({})
}

async function registerVerify(
  tokens: AuthTokens,
  credential: unknown,
  name?: string
) {
  const agent = await createTestAgent()
  return agent
    .post('/auth/passkeys/register/verify')
    .set('Authorization', bearer(tokens))
    .send({ credential, ...(name !== undefined ? { name } : {}) })
}

async function loginOptions(email?: string) {
  const agent = await createTestAgent()
  return agent
    .post('/auth/passkeys/login/options')
    .send(email !== undefined ? { email } : {})
}

async function loginVerify(credential: unknown) {
  const agent = await createTestAgent()
  return agent.post('/auth/passkeys/login/verify').send({ credential })
}

async function listPasskeys(tokens: AuthTokens) {
  const agent = await createTestAgent()
  return agent.get('/auth/passkeys').set('Authorization', bearer(tokens))
}

async function deletePasskey(tokens: AuthTokens, id: string) {
  const agent = await createTestAgent()
  return agent
    .delete(`/auth/passkeys/${id}`)
    .set('Authorization', bearer(tokens))
}

/** Full registration ceremony; returns the stored passkey id. */
async function registerPasskey(
  tokens: AuthTokens,
  authenticator: SoftwareAuthenticator,
  name?: string
): Promise<string> {
  const options = await registerOptions(tokens)
  expect(options.status).toBe(200)
  const res = await registerVerify(
    tokens,
    authenticator.register(options.body.data),
    name
  )
  expect(res.status).toBe(200)
  return res.body.data.id
}

/** Fetch login options, answer them, and verify. */
async function login(
  authenticator: SoftwareAuthenticator,
  overrides: AssertionOverrides = {},
  email?: string
) {
  const options = await loginOptions(email)
  expect(options.status).toBe(200)
  return loginVerify(authenticator.assert(options.body.data, overrides))
}

async function eventTypes(userId: string) {
  const events = await getTestPrisma().securityEvent.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { type: true }
  })
  return events.map(e => e.type as string)
}

async function storedPasskey(id: string) {
  return getTestPrisma().passkey.findUniqueOrThrow({ where: { id } })
}

async function openChallengeCount() {
  return getTestPrisma().authChallenge.count({ where: { consumedAt: null } })
}

describe('register options', () => {
  it('requires authentication', async () => {
    const agent = await createTestAgent()
    const res = await agent.post('/auth/passkeys/register/options').send({})
    expect(res.status).toBe(401)
  })

  it('issues a challenge bound to the user and stores it', async () => {
    const tokens = await createSessionForUser()

    const res = await registerOptions(tokens)

    expect(res.status).toBe(200)
    expect(res.body.data.challenge).toEqual(expect.any(String))
    expect(res.body.data.rp.id).toBe('localhost')
    expect(res.body.data.authenticatorSelection).toMatchObject({
      residentKey: 'required',
      userVerification: 'required'
    })

    const row = await getTestPrisma().authChallenge.findUniqueOrThrow({
      where: { challenge: res.body.data.challenge }
    })
    expect(row).toMatchObject({
      userId: tokens.user.id,
      type: 'WEBAUTHN_REGISTER',
      consumedAt: null
    })
  })

  it('excludes the credentials the user already registered', async () => {
    const tokens = await createSessionForUser()
    const authenticator = new SoftwareAuthenticator()
    await registerPasskey(tokens, authenticator)

    const res = await registerOptions(tokens)

    expect(res.body.data.excludeCredentials).toEqual([
      expect.objectContaining({ id: authenticator.id })
    ])
  })

  it('does not exclude revoked or other users credentials', async () => {
    const owner = await createSessionForUser()
    const other = await createSessionForUser()
    const passkeyId = await registerPasskey(owner, new SoftwareAuthenticator())
    await registerPasskey(other, new SoftwareAuthenticator())
    await deletePasskey(owner, passkeyId)

    const res = await registerOptions(owner)

    expect(res.body.data.excludeCredentials ?? []).toEqual([])
  })
})

describe('register verify', () => {
  it('stores the passkey and consumes the challenge', async () => {
    const tokens = await createSessionForUser()
    const authenticator = new SoftwareAuthenticator()
    const options = await registerOptions(tokens)

    const res = await registerVerify(
      tokens,
      authenticator.register(options.body.data),
      'Work laptop'
    )

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      name: 'Work laptop',
      lastUsedAt: null
    })

    const stored = await storedPasskey(res.body.data.id)
    expect(stored).toMatchObject({
      userId: tokens.user.id,
      credentialId: authenticator.id,
      counter: 0n,
      revokedAt: null
    })
    expect(await openChallengeCount()).toBe(0)
    expect(await eventTypes(tokens.user.id)).toContain('PASSKEY_REGISTERED')
  })

  it('shows the new passkey in the list', async () => {
    const tokens = await createSessionForUser()
    const id = await registerPasskey(tokens, new SoftwareAuthenticator(), 'A')

    const res = await listPasskeys(tokens)

    expect(res.body.data.passkeys.map((p: { id: string }) => p.id)).toEqual([
      id
    ])
  })

  it('rejects replaying the same registration response', async () => {
    const tokens = await createSessionForUser()
    const authenticator = new SoftwareAuthenticator()
    const options = await registerOptions(tokens)
    const credential = authenticator.register(options.body.data)

    expect((await registerVerify(tokens, credential)).status).toBe(200)
    const replay = await registerVerify(tokens, credential)

    expect(replay.status).toBe(401)
    expect(replay.body.error?.code).toBe('CHALLENGE_INVALID')
    expect(await getTestPrisma().passkey.count()).toBe(1)
  })

  it('rejects an expired challenge', async () => {
    const tokens = await createSessionForUser()
    const options = await registerOptions(tokens)
    await getTestPrisma().authChallenge.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) }
    })

    const res = await registerVerify(
      tokens,
      new SoftwareAuthenticator().register(options.body.data)
    )

    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('CHALLENGE_INVALID')
  })

  it('rejects a challenge that was issued to another user', async () => {
    const victim = await createSessionForUser()
    const attacker = await createSessionForUser()
    const victimOptions = await registerOptions(victim)

    const res = await registerVerify(
      attacker,
      new SoftwareAuthenticator().register(victimOptions.body.data)
    )

    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('CHALLENGE_INVALID')
    expect(await getTestPrisma().passkey.count()).toBe(0)
  })

  it('rejects a challenge the server never issued', async () => {
    const tokens = await createSessionForUser()

    const res = await registerVerify(
      tokens,
      new SoftwareAuthenticator().register({
        challenge: 'bm90LWlzc3VlZC1ieS10aGUtc2VydmVy',
        rp: { id: 'localhost' }
      })
    )

    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('CHALLENGE_INVALID')
  })

  it('rejects a login challenge used for registration', async () => {
    const tokens = await createSessionForUser()
    const loginChallenge = await loginOptions()

    const res = await registerVerify(
      tokens,
      new SoftwareAuthenticator().register(loginChallenge.body.data)
    )

    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('CHALLENGE_INVALID')
  })

  it.each<[string, CeremonyOverrides]>([
    ['a wrong origin', { origin: 'https://evil.example' }],
    ['a missing user-verification flag', { userVerified: false }],
    ['a mismatched challenge in clientDataJSON', { challenge: 'b3RoZXI' }]
  ])('rejects %s and records the failure', async (_label, overrides) => {
    const tokens = await createSessionForUser()
    const options = await registerOptions(tokens)
    // A mismatched challenge is a different (unknown) challenge to the server,
    // which is rejected earlier as CHALLENGE_INVALID.
    const expectedCode =
      overrides.challenge !== undefined
        ? 'CHALLENGE_INVALID'
        : 'PASSKEY_VERIFY_FAILED'

    const res = await registerVerify(
      tokens,
      new SoftwareAuthenticator().register(options.body.data, overrides)
    )

    expect(res.status).toBe(expectedCode === 'CHALLENGE_INVALID' ? 401 : 400)
    expect(res.body.error?.code).toBe(expectedCode)
    expect(await getTestPrisma().passkey.count()).toBe(0)
  })

  it('records PASSKEY_ASSERT_FAILED when verification fails', async () => {
    const tokens = await createSessionForUser()
    const options = await registerOptions(tokens)

    await registerVerify(
      tokens,
      new SoftwareAuthenticator().register(options.body.data, {
        origin: 'https://evil.example'
      })
    )

    expect(await eventTypes(tokens.user.id)).toContain('PASSKEY_ASSERT_FAILED')
  })

  it('rejects malformed clientDataJSON', async () => {
    const tokens = await createSessionForUser()
    const options = await registerOptions(tokens)
    const credential = new SoftwareAuthenticator().register(options.body.data)

    const res = await registerVerify(tokens, {
      ...credential,
      response: { ...credential.response, clientDataJSON: 'bm90LWpzb24' }
    })

    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('PASSKEY_VERIFY_FAILED')
  })

  it('rejects registering the same credential twice', async () => {
    const tokens = await createSessionForUser()
    const authenticator = new SoftwareAuthenticator()
    await registerPasskey(tokens, authenticator)

    // A client that ignores excludeCredentials and re-sends the same key.
    const options = await registerOptions(tokens)
    const res = await registerVerify(
      tokens,
      authenticator.register(options.body.data)
    )

    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('PASSKEY_VERIFY_FAILED')
    expect(await getTestPrisma().passkey.count()).toBe(1)
  })

  it('rejects registering a credential that belongs to another user', async () => {
    const owner = await createSessionForUser()
    const attacker = await createSessionForUser()
    const authenticator = new SoftwareAuthenticator()
    await registerPasskey(owner, authenticator)

    const options = await registerOptions(attacker)
    const res = await registerVerify(
      attacker,
      authenticator.register(options.body.data)
    )

    expect(res.status).toBe(400)
    expect(
      await getTestPrisma().passkey.count({ where: { userId: owner.user.id } })
    ).toBe(1)
    expect(
      await getTestPrisma().passkey.count({
        where: { userId: attacker.user.id }
      })
    ).toBe(0)
  })

  it('validates the passkey name', async () => {
    const tokens = await createSessionForUser()
    const options = await registerOptions(tokens)

    const res = await registerVerify(
      tokens,
      new SoftwareAuthenticator().register(options.body.data),
      'x'.repeat(65)
    )

    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('does not let a disabled user get registration options', async () => {
    const tokens = await createSessionForUser()
    await getTestPrisma().user.update({
      where: { id: tokens.user.id },
      data: { disabledAt: new Date() }
    })

    expect((await registerOptions(tokens)).status).toBe(403)
  })

  // Decision (plan: "decide whether it should"): keep as is. A failed
  // verification leaves the challenge usable until it expires (60s). The
  // challenge is random and only known to whoever requested it, and each
  // attempt is rate limited, so burning it would only hurt honest retries.
  it('does not consume the challenge when verification fails', async () => {
    const tokens = await createSessionForUser()
    const authenticator = new SoftwareAuthenticator()
    const options = await registerOptions(tokens)

    const failed = await registerVerify(
      tokens,
      authenticator.register(options.body.data, {
        origin: 'https://evil.example'
      })
    )
    expect(failed.status).toBe(400)
    expect(await openChallengeCount()).toBe(1)

    const retry = await registerVerify(
      tokens,
      authenticator.register(options.body.data)
    )
    expect(retry.status).toBe(200)
  })
})

describe('login options', () => {
  it('issues an anonymous challenge without credential hints', async () => {
    const res = await loginOptions()

    expect(res.status).toBe(200)
    expect(res.body.data.challenge).toEqual(expect.any(String))
    expect(res.body.data.allowCredentials ?? []).toEqual([])
    const row = await getTestPrisma().authChallenge.findUniqueOrThrow({
      where: { challenge: res.body.data.challenge }
    })
    expect(row).toMatchObject({ userId: null, type: 'WEBAUTHN_ASSERT' })
  })

  it('lists the credentials of a known email', async () => {
    const tokens = await createSessionForUser()
    const authenticator = new SoftwareAuthenticator()
    await registerPasskey(tokens, authenticator)

    const res = await loginOptions(tokens.user.email)

    expect(res.body.data.allowCredentials).toEqual([
      expect.objectContaining({ id: authenticator.id })
    ])
  })

  it('answers an unknown email exactly like an email without passkeys', async () => {
    const known = await createSessionForUser()
    const unknown = await loginOptions('nobody@example.com')
    const without = await loginOptions(known.user.email)

    expect(unknown.status).toBe(200)
    expect(without.status).toBe(200)
    expect(unknown.body.data.allowCredentials).toBeUndefined()
    expect(without.body.data.allowCredentials).toBeUndefined()
  })

  it('hides the credentials of a disabled user', async () => {
    const tokens = await createSessionForUser()
    await registerPasskey(tokens, new SoftwareAuthenticator())
    await getTestPrisma().user.update({
      where: { id: tokens.user.id },
      data: { disabledAt: new Date() }
    })

    const res = await loginOptions(tokens.user.email)

    expect(res.body.data.allowCredentials).toBeUndefined()
  })
})

describe('login verify', () => {
  async function registeredUser() {
    const tokens = await createSessionForUser()
    const authenticator = new SoftwareAuthenticator()
    const passkeyId = await registerPasskey(tokens, authenticator)
    return { tokens, authenticator, passkeyId }
  }

  it('signs in, creates a PASSKEY session and updates the passkey', async () => {
    const { tokens, authenticator, passkeyId } = await registeredUser()

    const res = await login(authenticator)

    expect(res.status).toBe(200)
    expect(res.body.data.user.id).toBe(tokens.user.id)
    expect(res.body.data.accessToken).toEqual(expect.any(String))

    const session = await getTestPrisma().session.findFirstOrThrow({
      where: { userId: tokens.user.id, authMethod: 'PASSKEY' }
    })
    expect(session.revokedAt).toBeNull()

    const stored = await storedPasskey(passkeyId)
    expect(stored.counter).toBe(1n)
    expect(stored.lastUsedAt).toEqual(expect.any(Date))
    expect(await eventTypes(tokens.user.id)).toContain('PASSKEY_ASSERTED')

    const agent = await createTestAgent()
    const me = await agent
      .get('/auth/me')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`)
    expect(me.status).toBe(200)
  })

  it('keeps working across logins as the counter advances', async () => {
    const { authenticator, passkeyId } = await registeredUser()

    expect((await login(authenticator)).status).toBe(200)
    expect((await login(authenticator)).status).toBe(200)

    expect((await storedPasskey(passkeyId)).counter).toBe(2n)
  })

  it('signs in with the email hint as well', async () => {
    const { tokens, authenticator } = await registeredUser()

    const res = await login(authenticator, {}, tokens.user.email)

    expect(res.status).toBe(200)
  })

  it('rejects replaying the same assertion', async () => {
    const { authenticator } = await registeredUser()
    const options = await loginOptions()
    const assertion = authenticator.assert(options.body.data)

    expect((await loginVerify(assertion)).status).toBe(200)
    const replay = await loginVerify(assertion)

    expect(replay.status).toBe(401)
    expect(replay.body.error?.code).toBe('CHALLENGE_INVALID')
  })

  it('rejects an expired challenge', async () => {
    const { authenticator } = await registeredUser()
    const options = await loginOptions()
    await getTestPrisma().authChallenge.updateMany({
      where: { challenge: options.body.data.challenge },
      data: { expiresAt: new Date(Date.now() - 1000) }
    })

    const res = await loginVerify(authenticator.assert(options.body.data))

    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('CHALLENGE_INVALID')
  })

  it('rejects a registration challenge used for login', async () => {
    const { tokens, authenticator } = await registeredUser()
    const registration = await registerOptions(tokens)

    const res = await loginVerify(authenticator.assert(registration.body.data))

    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('CHALLENGE_INVALID')
  })

  it('rejects an unknown credential and records it', async () => {
    const stranger = new SoftwareAuthenticator()

    const res = await login(stranger)

    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('PASSKEY_NOT_FOUND')
    const failed = await getTestPrisma().securityEvent.findMany({
      where: { type: 'PASSKEY_ASSERT_FAILED' }
    })
    expect(failed.map(e => e.metadata)).toContainEqual({ reason: 'not_found' })
  })

  it('rejects a revoked passkey and records it', async () => {
    const { tokens, authenticator, passkeyId } = await registeredUser()
    await deletePasskey(tokens, passkeyId)

    const res = await login(authenticator)

    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('PASSKEY_REVOKED')
    const failed = await getTestPrisma().securityEvent.findMany({
      where: { type: 'PASSKEY_ASSERT_FAILED' }
    })
    expect(failed.map(e => e.metadata)).toContainEqual({ reason: 'revoked' })
  })

  it('rejects a counter that does not advance (cloned authenticator)', async () => {
    const { authenticator, passkeyId } = await registeredUser()
    expect((await login(authenticator, { counter: 5 })).status).toBe(200)

    const res = await login(authenticator, { counter: 3 })

    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('PASSKEY_COUNTER_INVALID')
    expect((await storedPasskey(passkeyId)).counter).toBe(5n)
  })

  it('rejects a repeated counter value', async () => {
    const { authenticator } = await registeredUser()
    expect((await login(authenticator, { counter: 5 })).status).toBe(200)

    const res = await login(authenticator, { counter: 5 })

    expect(res.status).toBe(401)
    expect(res.body.error?.code).toBe('PASSKEY_COUNTER_INVALID')
  })

  it('does not let a disabled user sign in', async () => {
    const { tokens, authenticator } = await registeredUser()
    await getTestPrisma().user.update({
      where: { id: tokens.user.id },
      data: { disabledAt: new Date() }
    })

    const res = await login(authenticator)

    expect(res.status).toBe(403)
    expect(res.body.error?.code).toBe('FORBIDDEN')
    expect(
      await getTestPrisma().session.count({
        where: { userId: tokens.user.id, authMethod: 'PASSKEY' }
      })
    ).toBe(0)
  })

  it.each<[string, AssertionOverrides]>([
    ['a bad signature', { signWithWrongKey: true }],
    ['a wrong origin', { origin: 'https://evil.example' }],
    ['a missing user-verification flag', { userVerified: false }]
  ])('rejects %s without creating a session', async (_label, overrides) => {
    const { tokens, authenticator, passkeyId } = await registeredUser()

    const res = await login(authenticator, overrides)

    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('PASSKEY_VERIFY_FAILED')
    expect((await storedPasskey(passkeyId)).counter).toBe(0n)
    expect(
      await getTestPrisma().session.count({
        where: { userId: tokens.user.id, authMethod: 'PASSKEY' }
      })
    ).toBe(0)
    expect(await eventTypes(tokens.user.id)).toContain('PASSKEY_ASSERT_FAILED')
  })

  // Same decision as for registration: see the register test above.
  it('does not consume the challenge when verification fails', async () => {
    const { authenticator } = await registeredUser()
    const options = await loginOptions()

    const failed = await loginVerify(
      authenticator.assert(options.body.data, { signWithWrongKey: true })
    )
    expect(failed.status).toBe(400)

    const retry = await loginVerify(authenticator.assert(options.body.data))
    expect(retry.status).toBe(200)
  })

  it('rejects a malformed credential body', async () => {
    const res = await loginVerify({ id: 'x' })

    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('VALIDATION_ERROR')
  })
})

describe('list and revoke', () => {
  it('requires authentication', async () => {
    const agent = await createTestAgent()
    expect((await agent.get('/auth/passkeys')).status).toBe(401)
    expect(
      (
        await agent.delete(
          '/auth/passkeys/00000000-0000-4000-8000-000000000000'
        )
      ).status
    ).toBe(401)
  })

  it('lists only the callers own, non-revoked passkeys', async () => {
    const me = await createSessionForUser()
    const other = await createSessionForUser()
    const mine = await registerPasskey(me, new SoftwareAuthenticator(), 'Mine')
    const revoked = await registerPasskey(me, new SoftwareAuthenticator())
    await registerPasskey(other, new SoftwareAuthenticator(), 'Theirs')
    await deletePasskey(me, revoked)

    const res = await listPasskeys(me)

    expect(res.status).toBe(200)
    expect(res.body.data.passkeys).toHaveLength(1)
    expect(res.body.data.passkeys[0]).toMatchObject({ id: mine, name: 'Mine' })
  })

  it('does not leak key material', async () => {
    const me = await createSessionForUser()
    await registerPasskey(me, new SoftwareAuthenticator())

    const res = await listPasskeys(me)

    expect(Object.keys(res.body.data.passkeys[0]).sort()).toEqual([
      'backedUp',
      'createdAt',
      'deviceType',
      'id',
      'lastUsedAt',
      'name'
    ])
  })

  it('revokes the callers passkey', async () => {
    const me = await createSessionForUser()
    const id = await registerPasskey(me, new SoftwareAuthenticator())

    const res = await deletePasskey(me, id)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ ok: true })
    expect((await storedPasskey(id)).revokedAt).toEqual(expect.any(Date))
    expect((await listPasskeys(me)).body.data.passkeys).toEqual([])
  })

  it('answers 404 when revoking another users passkey and leaves it active', async () => {
    const owner = await createSessionForUser()
    const attacker = await createSessionForUser()
    const id = await registerPasskey(owner, new SoftwareAuthenticator())

    const res = await deletePasskey(attacker, id)

    expect(res.status).toBe(404)
    expect((await storedPasskey(id)).revokedAt).toBeNull()
  })

  it('answers 404 when revoking twice', async () => {
    const me = await createSessionForUser()
    const id = await registerPasskey(me, new SoftwareAuthenticator())

    expect((await deletePasskey(me, id)).status).toBe(200)
    expect((await deletePasskey(me, id)).status).toBe(404)
  })

  it('answers 404 for an id that is not a UUID', async () => {
    const me = await createSessionForUser()

    expect((await deletePasskey(me, 'not-a-uuid')).status).toBe(404)
  })

  it('records a revocation as PASSKEY_REVOKED, not as a registration', async () => {
    const me = await createSessionForUser()
    const id = await registerPasskey(me, new SoftwareAuthenticator())

    await deletePasskey(me, id)

    const types = await eventTypes(me.user.id)
    expect(types).toContain('PASSKEY_REVOKED')
    expect(types.filter(t => t === 'PASSKEY_REGISTERED')).toHaveLength(1)
  })
})
