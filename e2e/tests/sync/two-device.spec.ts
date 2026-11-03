import { test, expect } from '../../fixtures.js'
import { grantProPlan } from '../../../testing/helpers/billing/grant-pro.js'
import { createSessionForUser } from '../../../testing/helpers/auth/session.js'
import { createStorageState } from '../../../testing/helpers/auth/storage-state.js'
import {
  clearModalHitTargets,
  createTopicFromHome,
  domClick,
  openAccountSettings,
  topBack,
  waitForTopicGoneFromHome,
  waitForTopicOnHome
} from '../../helpers/journeys.js'

test.describe('two-device sync', () => {
  test('device B sees create then does not resurrect delete', async ({
    browser
  }) => {
    test.setTimeout(120_000)

    // Separate sessions so refresh-token rotation on one device does not revoke the other.
    const tokensA = await createSessionForUser()
    await grantProPlan(tokensA.user.id)
    const tokensB = await createSessionForUser({ userId: tokensA.user.id })

    const contextA = await browser.newContext({
      storageState: createStorageState(tokensA),
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true
    })
    const contextB = await browser.newContext({
      storageState: createStorageState(tokensB),
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true
    })
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()
    const title = `Synced ${Date.now()}`

    try {
      await pageA.goto('/')
      await pageB.goto('/')
      await clearModalHitTargets(pageA)
      await clearModalHitTargets(pageB)
      await expect(pageA.getByText('Topics', { exact: true })).toBeVisible()
      await expect(pageB.getByText('Topics', { exact: true })).toBeVisible()

      await openAccountSettings(pageA)
      await expect(pageA.getByText('Pro plan')).toBeVisible({ timeout: 30_000 })
      await domClick(topBack(pageA))

      await createTopicFromHome(pageA, title)
      await domClick(topBack(pageA))
      await expect(
        pageA.getByRole('button', { name: `Go to topic: ${title}` })
      ).toBeVisible()

      await waitForTopicOnHome(pageB, title)

      await domClick(
        pageA.getByRole('button', { name: `Go to topic: ${title}` })
      )
      await domClick(pageA.getByRole('button', { name: 'Topic settings' }))
      await domClick(pageA.getByRole('button', { name: 'Delete' }))
      await expect(
        pageA.getByRole('heading', { name: 'Delete topic?' })
      ).toBeVisible()
      // Confirm sheet Delete (dangerSoft) — not the settings footer Delete.
      await domClick(
        pageA.getByRole('button', { name: 'Delete', exact: true }).last()
      )

      await expect(
        pageA.getByRole('button', { name: `Go to topic: ${title}` })
      ).toHaveCount(0)

      await waitForTopicGoneFromHome(pageB, title)

      await expect
        .poll(
          async () => {
            await pageB.reload()
            await clearModalHitTargets(pageB)
            await pageB.getByText('Topics', { exact: true }).waitFor()
            return pageB
              .getByRole('button', { name: `Go to topic: ${title}` })
              .count()
          },
          { timeout: 15_000 }
        )
        .toBe(0)
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })
})
