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
}): Promise<VerifiedRegistrationResponse> {
  const { origins, rpID } = getWebAuthnConfig()

  return verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: input.expectedChallenge,
    expectedOrigin: origins,
    expectedRPID: rpID,
    requireUserVerification: true
  })
}

export async function verifyAuthentication(input: {
  response: AuthenticationResponseJSON
  expectedChallenge: string
  credential: WebAuthnCredential
}): Promise<VerifiedAuthenticationResponse> {
  const { origins, rpID } = getWebAuthnConfig()

  return verifyAuthenticationResponse({
    response: input.response,
    expectedChallenge: input.expectedChallenge,
    expectedOrigin: origins,
    expectedRPID: rpID,
    credential: input.credential,
    requireUserVerification: true
  })
}
