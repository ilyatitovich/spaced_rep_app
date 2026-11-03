import type { Browser } from '@playwright/test'
import { test, expect } from '../../fixtures.js'
import {
  closeDevices,
  openProDevices,
  type ProDevice
} from '../../helpers/devices.js'
import {
  clearModalHitTargets,
  createTopicFromHome,
  deleteTopicInSettings,
  domClick,
  gotoTopicSettings,
  openAccountSettings,
  renameTopicInSettings,
  topBack,
  topicIdOnHome,
  waitForTopicGoneFromHome,
  waitForTopicOnHome
} from '../../helpers/journeys.js'

/**
 * Two Pro devices that both already hold `title`, each parked on the topic
 * settings screen so edits work after the device goes offline (a reload
 * would fail without a network).
 */
async function twoDevicesSharingTopic(
  browser: Browser,
  title: string
): Promise<[ProDevice, ProDevice]> {
  const [a, b] = await openProDevices(browser, 2)
  if (!a || !b) throw new Error('Expected two devices')

  for (const { page } of [a, b]) {
    await page.goto('/')
    await clearModalHitTargets(page)
    await expect(page.getByText('Topics', { exact: true })).toBeVisible()
    await openAccountSettings(page)
    await expect(page.getByText('Pro plan')).toBeVisible({ timeout: 30_000 })
    await domClick(topBack(page))
  }

  await createTopicFromHome(a.page, title)
  await waitForTopicOnHome(b.page, title)

  const topicId = await topicIdOnHome(b.page, title)
  await gotoTopicSettings(a.page, topicId)
  await gotoTopicSettings(b.page, topicId)
  return [a, b]
}

async function topicCountOnHome(
  device: ProDevice,
  title: string
): Promise<number> {
  await device.page.reload()
  await clearModalHitTargets(device.page)
  await device.page.getByText('Topics', { exact: true }).waitFor()
  return device.page
    .getByRole('button', { name: `Go to topic: ${title}` })
    .count()
}

/** Pending outbox ops in the device's IndexedDB (transport-agnostic ack signal). */
async function queueDepth(device: ProDevice): Promise<number> {
  return device.page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('spacedRepApp')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const count = db
            .transaction('sync_queue')
            .objectStore('sync_queue')
            .count()
          count.onsuccess = () => {
            db.close()
            resolve(count.result)
          }
          count.onerror = () => reject(count.error)
        }
      })
  )
}

/** Wait until the device's outbox is empty, i.e. the server acked its edits. */
async function waitForQueueDrained(device: ProDevice): Promise<void> {
  await expect.poll(() => queueDepth(device), { timeout: 45_000 }).toBe(0)
}

/**
 * Go back online and wait until the device's queued edits are acked.
 *
 * Chromium's offline emulation can leave the sync WebSocket half-open, and a
 * push over it only fails after a 30s ack timeout. If the outbox has not
 * drained shortly after reconnecting, reload (like reopening the app): the
 * queue persists and the fresh page syncs over a fresh connection.
 */
async function reconnectAndDrainQueue(device: ProDevice): Promise<void> {
  await expect.poll(() => queueDepth(device)).toBeGreaterThan(0)
  await device.context.setOffline(false)

  let since = Date.now()
  await expect
    .poll(
      async () => {
        const depth = await queueDepth(device)
        if (depth > 0 && Date.now() - since > 8_000) {
          await device.page.reload()
          since = Date.now()
        }
        return depth
      },
      { timeout: 60_000 }
    )
    .toBe(0)
}

test.describe('multi-device sync: offline edits and last-write-wins', () => {
  test('offline rename on A reaches B after A reconnects', async ({
    browser
  }) => {
    test.setTimeout(240_000)
    const stamp = Date.now()
    // Titles must not contain one another: row lookup matches substrings.
    const base = `Offline ${stamp}`
    const renamed = `${stamp} renamed offline`
    const [a, b] = await twoDevicesSharingTopic(browser, base)

    try {
      await a.context.setOffline(true)
      await renameTopicInSettings(a.page, renamed)

      // The edit is only queued locally: B must not see it yet.
      expect(await topicCountOnHome(b, renamed)).toBe(0)
      expect(await topicCountOnHome(b, base)).toBe(1)

      await a.context.setOffline(false)

      await waitForTopicOnHome(b.page, renamed)
      await waitForTopicGoneFromHome(b.page, base)
    } finally {
      await closeDevices([a, b])
    }
  })

  // Same two offline edits, both arrival orders: the later edit (B) must win
  // whether it reaches the server first or last. Reconnects are sequential and
  // wait for the push to land, so each order is deterministic.
  for (const { order, reconnect } of [
    { order: 'A then B', reconnect: ['a', 'b'] },
    { order: 'B then A', reconnect: ['b', 'a'] }
  ] as const) {
    test(`concurrent offline renames, reconnecting ${order}: the later edit wins on both devices`, async ({
      browser
    }) => {
      test.setTimeout(240_000)
      const stamp = Date.now()
      const base = `Concurrent ${stamp}`
      const titleA = `${stamp} edited on A`
      const titleB = `${stamp} edited on B`
      const [a, b] = await twoDevicesSharingTopic(browser, base)

      try {
        await a.context.setOffline(true)
        await b.context.setOffline(true)

        await renameTopicInSettings(a.page, titleA)
        // B edits strictly after A, so B's whole-record write is the newer one.
        await renameTopicInSettings(b.page, titleB)

        for (const name of reconnect) {
          await reconnectAndDrainQueue({ a, b }[name])
        }

        for (const device of [a, b]) {
          await waitForTopicOnHome(device.page, titleB)
          await waitForTopicGoneFromHome(device.page, titleA)
          await waitForTopicGoneFromHome(device.page, base)
        }
      } finally {
        await closeDevices([a, b])
      }
    })
  }

  test('an offline edit older than a remote delete does not resurrect the topic', async ({
    browser
  }) => {
    test.setTimeout(240_000)
    const stamp = Date.now()
    const base = `Stale ${stamp}`
    const edited = `${stamp} stale edit`
    const [a, b] = await twoDevicesSharingTopic(browser, base)

    try {
      await a.context.setOffline(true)
      await renameTopicInSettings(a.page, edited)
      // B deletes after A's edit, so the tombstone is newer.
      await deleteTopicInSettings(b.page)
      await waitForQueueDrained(b)

      await a.context.setOffline(false)

      await waitForTopicGoneFromHome(a.page, edited)
      await waitForTopicGoneFromHome(a.page, base)
      await waitForTopicGoneFromHome(b.page, edited)
      await waitForTopicGoneFromHome(b.page, base)
    } finally {
      await closeDevices([a, b])
    }
  })

  test('an offline edit newer than a remote delete restores the topic', async ({
    browser
  }) => {
    test.setTimeout(240_000)
    const stamp = Date.now()
    const base = `Newer ${stamp}`
    const edited = `${stamp} newer edit`
    const [a, b] = await twoDevicesSharingTopic(browser, base)

    try {
      await a.context.setOffline(true)
      await deleteTopicInSettings(b.page)
      // Acked by the server before A edits, so A's upsert is strictly newer.
      await waitForQueueDrained(b)
      // A edits after B's delete, so the upsert is newer than the tombstone.
      await renameTopicInSettings(a.page, edited)

      await a.context.setOffline(false)

      await waitForTopicOnHome(a.page, edited)
      await waitForTopicOnHome(b.page, edited)
      expect(await topicCountOnHome(b, base)).toBe(0)
    } finally {
      await closeDevices([a, b])
    }
  })
})
