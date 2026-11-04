# ADR-3: Trust model for the extension

- Status: Accepted (implemented)
- Date: 2026-11-04

## Context

`Origin` is attacker-controlled outside browsers. An Origin allowlist for Turnstile was forgeable by any non-browser client.

## Decision

Never use `Origin` as an auth or bot-protection signal. The extension authenticates via the PKCE extension-grant flow. Bot protection applies to unauthenticated endpoints regardless of origin.

## Alternatives

- Allowlist by extension id header — forgeable.
- Per-install attestation — heavy for this product stage.

## Consequences

Extension sign-in may need an extra redirect through the grant flow. Unauthenticated OTP and similar routes always require Turnstile (or equivalent) when configured.
