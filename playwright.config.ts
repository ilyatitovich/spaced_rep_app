import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'
import { getTestEnv, loadTestEnv } from './testing/config/env.js'
import { TEST_PORTS, TEST_TIMEOUTS } from './testing/config/constants.js'

loadTestEnv()
const testEnv = getTestEnv()

const clientUrl = testEnv.playwrightBaseUrl
const serverUrl = `http://localhost:${TEST_PORTS.server}`

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: TEST_TIMEOUTS.e2eMs,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github'], ['list']]
    : [['html', { open: 'never' }], ['list']],
  globalSetup: './testing/setup/playwright.global-setup.ts',
  use: {
    baseURL: clientUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // App gates desktop widths (>640px) behind a QR interstitial.
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true
      }
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true
      }
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true
      }
    }
  ],
  webServer: [
    {
      command: 'pnpm --filter spaced_rep_pwa_server exec tsx src/server.ts',
      cwd: path.join(process.cwd(), 'apps/server'),
      url: `${serverUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(TEST_PORTS.server),
        LOG_LEVEL: 'error',
        DATABASE_URL: testEnv.databaseUrl,
        REDIS_URL: testEnv.redisUrl,
        CORS_ORIGIN: testEnv.corsOrigin,
        JWT_SECRET: testEnv.jwtSecret,
        OTP_PEPPER: testEnv.otpPepper,
        RESEND_API_KEY: 're_placeholder',
        WEBAUTHN_RP_ID: testEnv.webauthnRpId,
        WEBAUTHN_ORIGIN: testEnv.webauthnOrigin
      }
    },
    {
      command:
        'pnpm --filter spaced_rep_pwa_client exec vite --host 127.0.0.1 --port 5173',
      cwd: path.join(process.cwd(), 'apps/client'),
      url: clientUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_BACKEND_PROVIDER: 'custom',
        VITE_API_URL: serverUrl,
        VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA'
      }
    }
  ]
})
