import { test, expect } from '../../fixtures.js'

test.describe('app smoke', () => {
  test('loads the start screen', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('img', { name: 'SpacedRepApp Logo' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Start Local App' })
    ).toBeVisible()
  })
})
