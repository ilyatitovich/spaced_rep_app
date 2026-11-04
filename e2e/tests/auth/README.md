# Auth E2e

- [`email-otp.spec.ts`](email-otp.spec.ts) — OTP sign-in via the UI; reads the code with `testing/helpers/auth/email-otp.ts`.
- [`session.spec.ts`](session.spec.ts) — session lifecycle in the browser, seeded through `storageState`:
  - sign-out clears `auth.session` and revokes the session on the server;
  - an expired access token on a revoked session lands signed out;
  - an expired access token is refreshed on load (rotated refresh token, still signed in);
  - a refresh that fails with 5xx or a network error keeps the user signed in.

Passkey specs live in [`../passkeys`](../passkeys/README.md). Google browser specs stay future work.

Helpers:

- `testing/helpers/auth/email-otp.ts`
- `testing/helpers/auth/session.ts`
- `testing/helpers/auth/oauth.ts`
- `testing/helpers/auth/storage-state.ts` (pass `expiresIn: -60` to seed an already-expired access token)
- `testing/fixtures/auth.fixture.ts`
