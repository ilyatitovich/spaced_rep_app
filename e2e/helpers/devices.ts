import type { Browser, BrowserContext, Page } from '@playwright/test'
import { grantProPlan } from '../../testing/helpers/billing/grant-pro.js'
import { createSessionForUser } from '../../testing/helpers/auth/session.js'
import { createStorageState } from '../../testing/helpers/auth/storage-state.js'

export interface ProDevice {
  context: BrowserContext
  page: Page
}

/**
 * N browser contexts signed in as the same Pro user. Each context has its own
 * IndexedDB and session, so each registers as a separate sync device (separate
 * sessions also keep refresh-token rotation on one from revoking another).
 */
export async function openProDevices(
  browser: Browser,
  count: number
): Promise<ProDevice[]> {
  const first = await createSessionForUser()
  await grantProPlan(first.user.id)
  const sessions = [first]
  for (let i = 1; i < count; i++) {
    sessions.push(await createSessionForUser({ userId: first.user.id }))
  }

  return Promise.all(
    sessions.map(async tokens => {
      const context = await browser.newContext({
        storageState: createStorageState(tokens),
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true
      })
      return { context, page: await context.newPage() }
    })
  )
}

export async function closeDevices(devices: ProDevice[]): Promise<void> {
  await Promise.all(devices.map(device => device.context.close()))
}
