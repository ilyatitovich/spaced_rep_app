import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSessionForUser } from '../../../../testing/helpers/auth/session.js'
import { createTestAgent } from '../../../../testing/helpers/http/supertest-app.js'
import {
  cardFactory,
  getTestPrisma,
  topicFactory
} from '../../../../testing/index.js'
import {
  deleteAccount,
  setAccountBillingCancelForTests,
  setAccountMediaStorageForTests
} from './services/account.service.js'
import type { R2Storage } from '../shared/lib/r2-storage.js'

describe('DELETE /auth/account', () => {
  afterEach(() => {
    setAccountMediaStorageForTests(null)
    setAccountBillingCancelForTests(null)
  })

  it('removes the user, topics, cards, sessions, and R2 prefix', async () => {
    const tokens = await createSessionForUser()
    const userId = tokens.user.id
    const topic = await topicFactory.create({ userId })
    await cardFactory.create({ userId, topicId: topic.id })

    const deletePrefix = vi.fn(async () => undefined)
    setAccountMediaStorageForTests({
      deletePrefix
    } as unknown as R2Storage)

    const agent = await createTestAgent()
    const res = await agent
      .delete('/auth/account')
      .set('Authorization', `Bearer ${tokens.accessToken}`)

    expect(res.status).toBe(204)

    const prisma = getTestPrisma()
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull()
    expect(await prisma.topic.count({ where: { userId } })).toBe(0)
    expect(await prisma.card.count({ where: { userId } })).toBe(0)
    expect(await prisma.session.count({ where: { userId } })).toBe(0)
    expect(deletePrefix).toHaveBeenCalledWith(`${userId}/`)

    const again = await agent
      .delete('/auth/account')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
    expect(again.status).toBe(404)
  })

  it('deleteAccount throws when the user id is already gone', async () => {
    await expect(deleteAccount(crypto.randomUUID())).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND'
    })
  })
})
