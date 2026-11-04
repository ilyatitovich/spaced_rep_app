# Passkey E2e

- [`passkey.spec.ts`](passkey.spec.ts) — registers a passkey from Settings → Passkeys with Playwright's virtual authenticator, signs out, and signs back in with only the passkey; a removed passkey is rejected (401) and no session is created.

Skipped on WebKit: Playwright's Linux WebKit has no WebAuthn, and the app reports passkeys as unsupported there.

Helpers:

- `testing/helpers/webauthn/virtual-authenticator.ts`
- `testing/helpers/webauthn/passkey-storage.ts`
- `testing/fixtures/webauthn.fixture.ts`

Playwright >= 1.61 provides `BrowserContext.credentials` for virtual authenticators.
