import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  type VerifiedAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type WebAuthnCredential
} from '@simplewebauthn/server'
import { env } from '../../shared/config/env.js'

export function getWebAuthnConfig() {
  return {
    rpID: env.WEBAUTHN_RP_ID,
    rpName: env.WEBAUTHN_RP_NAME,
    origins: env.WEBAUTHN_ORIGIN,
    challengeTtlSeconds: env.WEBAUTHN_CHALLENGE_TTL_SECONDS
  }
}

export function originsForAssertion(
  configured: string[],
  origin: string | null
): string[] {
  if (
    !origin?.startsWith('chrome-extension://') ||
    configured.includes(origin)
  ) {
    return configured
  }
  return [...configured, origin]
}

function originFromClientData(clientDataJSON: string): string | null {
  for (const encoding of ['base64url', 'base64'] as const) {
    try {
      const json = Buffer.from(clientDataJSON, encoding).toString('utf8')
      const origin = (JSON.parse(json) as { origin?: unknown }).origin
      if (typeof origin === 'string') return origin
    } catch {
      continue
    }
  }
  return null
}

function expectedOrigins(
  clientDataJSON: string,
  requestOrigin?: string | null
): string[] {
  const configured = getWebAuthnConfig().origins
  return originsForAssertion(
    originsForAssertion(configured, originFromClientData(clientDataJSON)),
    requestOrigin ?? null
  )
}

/** Encode user UUID string as UTF-8 bytes for WebAuthn user.id (≤36 bytes). */
export function userIdToWebAuthnBytes(userId: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(userId)
}

export async function createRegistrationOptions(input: {
  userId: string
  email: string
  excludeCredentials: Array<{
    id: string
    transports?: AuthenticatorTransportFuture[]
  }>
}): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { rpID, rpName } = getWebAuthnConfig()

  return generateRegistrationOptions({
    rpName,
    rpID,
    userName: input.email,
    userID: userIdToWebAuthnBytes(input.userId),
    userDisplayName: input.email,
    attestationType: 'none',
    excludeCredentials: input.excludeCredentials,
    authenticatorSelection: {
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'required'
    },
    timeout: 60_000
  })
}

export async function createAuthenticationOptions(input: {
  allowCredentials?: Array<{
    id: string
    transports?: AuthenticatorTransportFuture[]
  }>
}): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { rpID } = getWebAuthnConfig()

  return generateAuthenticationOptions({
    rpID,
    allowCredentials: input.allowCredentials,
    userVerification: 'required',
    timeout: 60_000
  })
}

export async function verifyRegistration(input: {
  response: RegistrationResponseJSON
  expectedChallenge: string
  origin?: string | null
}): Promise<VerifiedRegistrationResponse> {
  const { rpID } = getWebAuthnConfig()

  return verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: input.expectedChallenge,
    expectedOrigin: expectedOrigins(
      input.response.response.clientDataJSON,
      input.origin
    ),
    expectedRPID: rpID,
    requireUserVerification: true
  })
}

export async function verifyAuthentication(input: {
  response: AuthenticationResponseJSON
  expectedChallenge: string
  credential: WebAuthnCredential
  origin?: string | null
}): Promise<VerifiedAuthenticationResponse> {
  const { rpID } = getWebAuthnConfig()

  return verifyAuthenticationResponse({
    response: input.response,
    expectedChallenge: input.expectedChallenge,
    expectedOrigin: expectedOrigins(
      input.response.response.clientDataJSON,
      input.origin
    ),
    expectedRPID: rpID,
    credential: input.credential,
    requireUserVerification: true
  })
}
