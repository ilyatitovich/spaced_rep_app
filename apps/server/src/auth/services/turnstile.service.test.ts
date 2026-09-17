import { expect, it } from 'vitest'

import { verifyTurnstileToken } from './turnstile.service.js'

it('skips bot checks for chrome-extension origins', async () => {
  await expect(
    verifyTurnstileToken('not-a-token', null, 'chrome-extension://abcdef')
  ).resolves.toBeUndefined()
})
