import type { Browser, Page } from '@playwright/test'
import { test, expect } from '../../fixtures.js'
import { getTestPrisma } from '../../../testing/db/prisma.js'
import {
  createSessionForUser,
  type AuthTokens
} from '../../../testing/helpers/auth/session.js'
import { createStorageState } from '../../../testing/helpers/auth/storage-state.js'
import { domClick, openAccountSettings } from '../../helpers/journeys.js'

const AUTH_SESSION_KEY = 'auth.session'

interface StoredSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: { id: string; email: string }
}

/** Open a page whose stored access token is already past its expiry. */
async function openWithExpiredAccessToken(
  browser: Browser,
  tokens: AuthTokens
): Promise<Page> {
  const context = await browser.newContext({
    storageState: createStorageState({ ...tokens, expiresIn: -60 })
  })
  return context.newPage()
}

async function storedSession(page: Page): Promise<StoredSession | null> {
  const raw = await page.evaluate(
    key => localStorage.getItem(key),
    AUTH_SESSION_KEY
  )
  return raw === null ? null : (JSON.parse(raw) as StoredSession)
}

async function sessionRow(tokens: AuthTokens) {
  const [row] = await getTestPrisma().session.findMany({
    where: { userId: tokens.user.id }
  })
  return row
}

test.describe('sign-out', () => {
  test('signing out clears the browser session and revokes it on the server', async ({
    browser
  }) => {
    const tokens = await createSessionForUser()
    const context = await browser.newContext({
      storageState: createStorageState(tokens)
    })
    const page = await context.newPage()

    await page.goto('/')
    await openAccountSettings(page)
    await expect(
      page.getByText(tokens.user.email, { exact: true })
    ).toBeVisible()

    await domClick(page.getByRole('button', { name: 'Sign out' }))

    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0)
    expect(await storedSession(page)).toBeNull()
    await expect
      .poll(async () => (await sessionRow(tokens))?.revokedAt ?? null)
      .not.toBeNull()

    // The signed-out state survives a reload: nothing is left to restore.
    await page.reload()
    await openAccountSettings(page)
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

    await context.close()
  })
})

test.describe('revoked session', () => {
  test('an expired access token on a revoked session lands signed out', async ({
    browser
  }) => {
    const tokens = await createSessionForUser()
    await getTestPrisma().session.updateMany({
      where: { userId: tokens.user.id },
      data: { revokedAt: new Date() }
    })

    const page = await openWithExpiredAccessToken(browser, tokens)
    await page.goto('/')
    await openAccountSettings(page)

    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0)
    expect(await storedSession(page)).toBeNull()

    await page.context().close()
  })
})

test.describe('transparent token refresh', () => {
  test('an expired access token is refreshed on load without signing out', async ({
    browser
  }) => {
    const tokens = await createSessionForUser()
    const page = await openWithExpiredAccessToken(browser, tokens)

    const refreshRequest = page.waitForRequest(
      request =>
        request.url().endsWith('/auth/token/refresh') &&
        request.method() === 'POST'
    )
    await page.goto('/')
    await refreshRequest

    await openAccountSettings(page)
    await expect(
      page.getByText(tokens.user.email, { exact: true })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

    await expect
      .poll(async () => (await storedSession(page))?.refreshToken)
      .not.toBe(tokens.refreshToken)
    const rotated = await storedSession(page)
    expect(rotated?.expiresAt).toBeGreaterThan(Date.now())
    expect(rotated?.user.id).toBe(tokens.user.id)

    const old = await getTestPrisma().refreshToken.findMany({
      where: { session: { userId: tokens.user.id } },
      orderBy: { createdAt: 'asc' }
    })
    expect(old).toHaveLength(2)
    expect(old[0]?.revokedAt).not.toBeNull()
    expect(old[1]?.revokedAt).toBeNull()

    await page.context().close()
  })

  test('a failed refresh (server error) keeps the user signed in', async ({
    browser
  }) => {
    const tokens = await createSessionForUser()
    const page = await openWithExpiredAccessToken(browser, tokens)
    await page.route('**/auth/token/refresh', route =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'x' } })
      })
    )

    await page.goto('/')
    await openAccountSettings(page)

    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    expect((await storedSession(page))?.refreshToken).toBe(tokens.refreshToken)

    await page.context().close()
  })

  test('a refresh that cannot reach the server keeps the user signed in', async ({
    browser
  }) => {
    const tokens = await createSessionForUser()
    const page = await openWithExpiredAccessToken(browser, tokens)
    await page.route('**/auth/token/refresh', route => route.abort())

    await page.goto('/')
    await openAccountSettings(page)

    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    expect((await storedSession(page))?.refreshToken).toBe(tokens.refreshToken)

    await page.context().close()
  })
})
