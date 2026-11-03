import { test, expect } from '../../fixtures.js'
import { closeDevices, openProDevices } from '../../helpers/devices.js'
import { gotoDataSync } from '../../helpers/journeys.js'

// Mirrors `PRO_DEVICE_LIMIT` in the client / server; e2e does not import app code.
const PRO_DEVICE_LIMIT = 3

test.describe('sync device limit', () => {
  test('a fourth device is paused and does not take a sync slot', async ({
    browser
  }) => {
    test.setTimeout(150_000)
    const devices = await openProDevices(browser, PRO_DEVICE_LIMIT + 1)
    const allowed = devices.slice(0, PRO_DEVICE_LIMIT)
    const extra = devices[PRO_DEVICE_LIMIT]

    try {
      // One at a time, so each registers before the next one connects.
      for (const { page } of allowed) {
        await gotoDataSync(page)
        await expect(page.getByText('Up to date')).toBeVisible({
          timeout: 30_000
        })
      }

      await gotoDataSync(extra.page)
      await expect(extra.page.getByText('Sync paused')).toBeVisible({
        timeout: 30_000
      })
      // Paused, not revoked or erroring: the sync button is disabled.
      await expect(
        extra.page.getByRole('button', { name: 'Sync now' })
      ).toBeDisabled()

      // The server still lists only the allowed devices.
      const first = allowed[0]

      await gotoDataSync(first.page)
      await expect(
        first.page.getByText(
          `Devices · ${PRO_DEVICE_LIMIT} of ${PRO_DEVICE_LIMIT}`
        )
      ).toBeVisible({ timeout: 30_000 })
    } finally {
      await closeDevices(devices)
    }
  })
})
