import { test as base } from './base.fixture.js'
import {
  installVirtualAuthenticator,
  WebAuthnHelper
} from '../helpers/webauthn/virtual-authenticator.js'

type WebAuthnFixtures = {
  webAuthn: WebAuthnHelper
}

/**
 * Installs Playwright's virtual WebAuthn authenticator on the test context.
 * Use for future passkey register/login e2e specs.
 */
export const test = base.extend<WebAuthnFixtures>({
  webAuthn: async ({ context }, use) => {
    const helper = await installVirtualAuthenticator(context)
    await use(helper)
  }
})

export { expect } from '@playwright/test'
export { WebAuthnHelper }
