import { test, expect } from '../../fixtures.js'

test.describe('app smoke', () => {
  test('loads the topics home', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('Topics', { exact: true })).toBeVisible()
    await expect(
      page.getByText('No topics yet.').or(page.getByRole('list'))
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Create topic' })
    ).toBeVisible()
  })
})
