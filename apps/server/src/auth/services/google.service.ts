import { createRemoteJWKSet, jwtVerify } from 'jose'
import { env } from '../../shared/config/env.js'
import {
  BadGatewayError,
  BadRequestError,
  UnauthorizedError
} from '../../shared/lib/errors.js'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
)

export type GoogleIdClaims = {
  sub: string
  email: string
  emailVerified: boolean
}

type GoogleTokenResponse = {
  id_token?: string
  error?: string
  error_description?: string
}

export async function exchangeGoogleCode(input: {
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<GoogleIdClaims> {
  if (!env.GOOGLE_REDIRECT_URIS.includes(input.redirectUri)) {
    throw new BadRequestError('Invalid redirect URI')
  }

  let response: Response
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: input.code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: input.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: input.codeVerifier
      })
    })
  } catch {
    throw new BadGatewayError('Failed to reach Google token endpoint')
  }

  const body = (await response.json()) as GoogleTokenResponse

  if (!response.ok || !body.id_token) {
    const message =
      body.error_description || body.error || 'Google token exchange failed'
    if (response.status >= 500) {
      throw new BadGatewayError(message)
    }
    throw new BadRequestError(message, 'GOOGLE_EXCHANGE_FAILED')
  }

  return verifyGoogleIdToken(body.id_token)
}

async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdClaims> {
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: env.GOOGLE_CLIENT_ID
    })

    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new UnauthorizedError('Invalid Google ID token subject')
    }

    if (typeof payload.email !== 'string' || !payload.email) {
      throw new BadRequestError('Google account has no email')
    }

    const emailVerified = payload.email_verified === true
    if (!emailVerified) {
      throw new BadRequestError('Google email is not verified')
    }

    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: true
    }
  } catch (err) {
    if (err instanceof BadRequestError || err instanceof UnauthorizedError) {
      throw err
    }
    throw new UnauthorizedError('Invalid Google ID token')
  }
}
