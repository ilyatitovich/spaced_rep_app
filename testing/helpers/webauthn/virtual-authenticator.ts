import type { BrowserContext } from '@playwright/test'
import { WEBAUTHN_TEST_RP_ID } from '../../config/constants.js'

export type VirtualPasskey = {
  id: string
  rpId: string
  userHandle: string
  privateKey: string
  publicKey: string
}

/**
 * Playwright virtual WebAuthn authenticator helpers (Playwright >= 1.61).
 * Uses BrowserContext.credentials — works in Chromium, Firefox, and WebKit.
 */
export class WebAuthnHelper {
  constructor(private readonly context: BrowserContext) {}

  async install(): Promise<void> {
    await this.context.credentials.install()
  }

  async seedPasskey(
    rpId = WEBAUTHN_TEST_RP_ID,
    credential?: Partial<
      Pick<VirtualPasskey, 'id' | 'userHandle' | 'privateKey' | 'publicKey'>
    >
  ): Promise<VirtualPasskey> {
    return this.context.credentials.create(rpId, credential)
  }

  async listPasskeys(rpId = WEBAUTHN_TEST_RP_ID): Promise<VirtualPasskey[]> {
    return this.context.credentials.get({ rpId })
  }

  async captureRegisteredPasskey(
    rpId = WEBAUTHN_TEST_RP_ID
  ): Promise<VirtualPasskey> {
    const [credential] = await this.listPasskeys(rpId)
    if (!credential) {
      throw new Error(`No virtual passkey found for rpId=${rpId}`)
    }
    return credential
  }
}

export async function installVirtualAuthenticator(
  context: BrowserContext
): Promise<WebAuthnHelper> {
  const helper = new WebAuthnHelper(context)
  await helper.install()
  return helper
}

export async function seedPasskey(
  context: BrowserContext,
  rpId = WEBAUTHN_TEST_RP_ID
): Promise<VirtualPasskey> {
  const helper = await installVirtualAuthenticator(context)
  return helper.seedPasskey(rpId)
}
