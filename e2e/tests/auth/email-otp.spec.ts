import { test, expect } from '../../fixtures.js'
import { readOtpFromRedis } from '../../../testing/helpers/auth/email-otp.js'
import { domClick, openAccountSettings } from '../../helpers/journeys.js'

test.describe('email OTP sign-in', () => {
  test('OTP sign-in opens settings as that user', async ({ page }) => {
    const email = `otp-e2e-${Date.now()}@example.com`

    await page.goto('/')
    await openAccountSettings(page)
    await domClick(page.getByRole('button', { name: 'Sign in' }))

    await expect(
      page.getByRole('button', { name: 'Continue with Email' })
    ).toBeVisible()
    await domClick(page.getByRole('button', { name: 'Continue with Email' }))

    await page.getByLabel('Email address').fill(email)
    await expect(page.getByRole('button', { name: 'Send code' })).toBeEnabled({
      timeout: 30_000
    })
    await domClick(page.getByRole('button', { name: 'Send code' }))

    await expect(page.getByText('Enter your code')).toBeVisible()
    const code = await readOtpFromRedis(email)
    await page.getByLabel('Verification code').fill(code)

    await expect(page.getByText(email, { exact: true })).toBeVisible({
      timeout: 30_000
    })
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  })
})
