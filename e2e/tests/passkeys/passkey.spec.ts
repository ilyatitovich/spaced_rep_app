import type { Page } from '@playwright/test'
import { test, expect } from '../../fixtures.js'
import { getTestPrisma } from '../../../testing/db/prisma.js'
import { createSessionForUser } from '../../../testing/helpers/auth/session.js'
import { createStorageState } from '../../../testing/helpers/auth/storage-state.js'
import { installVirtualAuthenticator } from '../../../testing/helpers/webauthn/virtual-authenticator.js'
import { domClick, openAccountSettings } from '../../helpers/journeys.js'

/** The button stays disabled until the app reports it is online. */
async function addPasskey(page: Page): Promise<void> {
  const add = page.getByRole('button', { name: 'Add passkey' })
  await expect(add).toBeEnabled()
  await domClick(add)
}

test.describe('passkeys', () => {
  test.skip(
    ({ browserName }) => browserName === 'webkit',
    'Playwright WebKit on Linux has no WebAuthn; the app reports passkeys as unsupported there.'
  )

  test('a registered passkey signs the same user back in', async ({
    browser
  }) => {
    const tokens = await createSessionForUser()
    const context = await browser.newContext({
      storageState: createStorageState(tokens)
    })
    const webAuthn = await installVirtualAuthenticator(context)
    const page = await context.newPage()
    const prisma = getTestPrisma()

    // Register from Settings → Passkeys.
    await page.goto('/')
    await openAccountSettings(page)
    await domClick(page.getByRole('button', { name: 'Passkeys' }))
    await addPasskey(page)
    await expect(page.getByText('1 passkey', { exact: true })).toBeVisible()

    const virtual = await webAuthn.captureRegisteredPasskey()
    const stored = await prisma.passkey.findMany({
      where: { userId: tokens.user.id }
    })
    expect(stored).toHaveLength(1)
    expect(stored[0]?.credentialId).toBe(virtual.id)
    expect(stored[0]?.revokedAt).toBeNull()
    expect(
      await prisma.securityEvent.count({
        where: { userId: tokens.user.id, type: 'PASSKEY_REGISTERED' }
      })
    ).toBe(1)

    // Sign out, then back in using only the passkey.
    await page.goto('/')
    await openAccountSettings(page)
    await domClick(page.getByRole('button', { name: 'Sign out' }))
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

    await domClick(page.getByRole('button', { name: 'Sign in' }))
    await domClick(page.getByRole('button', { name: 'Sign in with Passkey' }))

    await expect(
      page.getByText(tokens.user.email, { exact: true })
    ).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

    expect(
      await prisma.securityEvent.count({
        where: { userId: tokens.user.id, type: 'PASSKEY_ASSERTED' }
      })
    ).toBe(1)
    const passkeySessions = await prisma.session.findMany({
      where: { userId: tokens.user.id, authMethod: 'PASSKEY', revokedAt: null }
    })
    expect(passkeySessions).toHaveLength(1)

    await context.close()
  })

  test('a removed passkey no longer signs in', async ({ browser }) => {
    const tokens = await createSessionForUser()
    const context = await browser.newContext({
      storageState: createStorageState(tokens)
    })
    await installVirtualAuthenticator(context)
    const page = await context.newPage()
    const prisma = getTestPrisma()

    await page.goto('/')
    await openAccountSettings(page)
    await domClick(page.getByRole('button', { name: 'Passkeys' }))
    await addPasskey(page)
    await expect(page.getByText('1 passkey', { exact: true })).toBeVisible()

    await domClick(page.getByRole('button', { name: /^Remove .+/ }))
    await domClick(page.getByRole('button', { name: 'Remove', exact: true }))
    await expect
      .poll(() =>
        prisma.passkey.count({
          where: { userId: tokens.user.id, revokedAt: { not: null } }
        })
      )
      .toBe(1)

    await page.goto('/')
    await openAccountSettings(page)
    await domClick(page.getByRole('button', { name: 'Sign out' }))
    await domClick(page.getByRole('button', { name: 'Sign in' }))
    const verify = page.waitForResponse(res =>
      res.url().endsWith('/auth/passkeys/login/verify')
    )
    await domClick(page.getByRole('button', { name: 'Sign in with Passkey' }))

    expect((await verify).status()).toBe(401)
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0)
    expect(
      await prisma.session.count({
        where: { userId: tokens.user.id, authMethod: 'PASSKEY' }
      })
    ).toBe(0)

    await context.close()
  })
})
