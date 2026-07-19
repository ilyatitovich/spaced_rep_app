function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function createPkcePair(): Promise<{
  codeVerifier: string
  codeChallenge: string
  state: string
}> {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32))
  const codeVerifier = base64UrlEncode(verifierBytes.buffer)

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(codeVerifier)
  )
  const codeChallenge = base64UrlEncode(digest)

  const stateBytes = crypto.getRandomValues(new Uint8Array(16))
  const state = base64UrlEncode(stateBytes.buffer)

  return { codeVerifier, codeChallenge, state }
}

export function googleRedirectUri(): string {
  return `${window.location.origin}/oauth/google/callback`
}

export function buildGoogleAuthorizeUrl(input: {
  clientId: string
  redirectUri: string
  codeChallenge: string
  state: string
}): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: 'openid email profile',
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'online',
    prompt: 'select_account'
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}
