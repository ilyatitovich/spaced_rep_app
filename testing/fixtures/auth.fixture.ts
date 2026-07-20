import type { Page } from '@playwright/test'
import { test as base } from './base.fixture.js'
import { authenticatedContext } from '../helpers/auth/storage-state.js'
import {
  createSessionForUser,
  type AuthTokens
} from '../helpers/auth/session.js'

type AuthFixtures = {
  testUser: AuthTokens
  authenticatedPage: Page
}

/**
 * Auth fixtures for future authenticated e2e specs.
 * Not used by smoke tests yet — import from e2e/fixtures when needed.
 */
export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use) => {
    const tokens = await createSessionForUser()
    await use(tokens)
  },

  authenticatedPage: async ({ browser }, use) => {
    const { context } = await authenticatedContext(browser)
    const page = await context.newPage()
    await use(page)
    await context.close()
  }
})

export { expect } from '@playwright/test'
export type { AuthTokens }
