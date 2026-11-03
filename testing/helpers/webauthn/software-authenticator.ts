import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
  type KeyObject
} from 'node:crypto'

/**
 * A tiny in-process WebAuthn authenticator (ES256, "none" attestation) for
 * server integration tests. It produces real attestations and assertions that
 * `@simplewebauthn/server` verifies for real, with knobs to break each part.
 * For browser tests use `virtual-authenticator.ts` instead.
 */

type CborValue = number | string | Uint8Array | Map<number | string, CborValue>

function cborHead(major: number, value: number): Buffer {
  if (value < 24) return Buffer.from([(major << 5) | value])
  if (value < 0x100) return Buffer.from([(major << 5) | 24, value])
  if (value < 0x10000) {
    const buf = Buffer.alloc(3)
    buf[0] = (major << 5) | 25
    buf.writeUInt16BE(value, 1)
    return buf
  }
  const buf = Buffer.alloc(5)
  buf[0] = (major << 5) | 26
  buf.writeUInt32BE(value, 1)
  return buf
}

function cbor(value: CborValue): Buffer {
  if (typeof value === 'number') {
    return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value)
  }
  if (typeof value === 'string') {
    const text = Buffer.from(value, 'utf8')
    return Buffer.concat([cborHead(3, text.length), text])
  }
  if (value instanceof Uint8Array) {
    return Buffer.concat([cborHead(2, value.length), value])
  }
  const parts: Buffer[] = [cborHead(5, value.size)]
  for (const [key, entry] of value) {
    parts.push(cbor(key), cbor(entry))
  }
  return Buffer.concat(parts)
}

const FLAG_UP = 0x01
const FLAG_UV = 0x04
const FLAG_AT = 0x40

const sha256 = (data: Buffer | string) =>
  createHash('sha256').update(data).digest()

const b64url = (data: Buffer) => data.toString('base64url')

export interface CreationOptionsLike {
  challenge: string
  rp: { id?: string }
}

export interface RequestOptionsLike {
  challenge: string
  rpId?: string
}

export interface CeremonyOverrides {
  /** Origin written into clientDataJSON. Default: the authenticator's origin. */
  origin?: string
  /** Challenge written into clientDataJSON. Default: the one from the options. */
  challenge?: string
  /** Set the user-verified flag. Default: true (the server requires it). */
  userVerified?: boolean
}

export interface AssertionOverrides extends CeremonyOverrides {
  /** Use this signature counter instead of incrementing. */
  counter?: number
  /** Sign with a different key so the signature does not verify. */
  signWithWrongKey?: boolean
  /** Replace the credential id in the response (unknown credential). */
  credentialId?: string
}

export interface SoftwareAuthenticatorOptions {
  rpId?: string
  origin?: string
}

export class SoftwareAuthenticator {
  readonly credentialId: Buffer = randomBytes(32)
  /** Last counter value reported by this authenticator. */
  counter = 0

  private readonly privateKey: KeyObject
  private readonly publicKey: KeyObject
  private readonly rpId: string
  private readonly origin: string

  constructor(options: SoftwareAuthenticatorOptions = {}) {
    const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    this.privateKey = pair.privateKey
    this.publicKey = pair.publicKey
    this.rpId = options.rpId ?? process.env.WEBAUTHN_RP_ID ?? 'localhost'
    this.origin =
      options.origin ??
      process.env.WEBAUTHN_ORIGIN?.split(',')[0]?.trim() ??
      'http://localhost:5173'
  }

  get id(): string {
    return b64url(this.credentialId)
  }

  private coseKey(): Buffer {
    const jwk = this.publicKey.export({ format: 'jwk' })
    return cbor(
      new Map<number | string, CborValue>([
        [1, 2], // kty: EC2
        [3, -7], // alg: ES256
        [-1, 1], // crv: P-256
        [-2, Buffer.from(jwk.x ?? '', 'base64url')],
        [-3, Buffer.from(jwk.y ?? '', 'base64url')]
      ])
    )
  }

  private clientData(
    type: 'webauthn.create' | 'webauthn.get',
    challenge: string,
    overrides: CeremonyOverrides
  ): Buffer {
    return Buffer.from(
      JSON.stringify({
        type,
        challenge: overrides.challenge ?? challenge,
        origin: overrides.origin ?? this.origin,
        crossOrigin: false
      })
    )
  }

  private header(flags: number): Buffer {
    const counter = Buffer.alloc(4)
    counter.writeUInt32BE(this.counter)
    return Buffer.concat([sha256(this.rpId), Buffer.from([flags]), counter])
  }

  /** Build a navigator.credentials.create() response for the given options. */
  register(options: CreationOptionsLike, overrides: CeremonyOverrides = {}) {
    this.counter = 0
    const flags =
      FLAG_UP | FLAG_AT | (overrides.userVerified === false ? 0 : FLAG_UV)
    const idLength = Buffer.alloc(2)
    idLength.writeUInt16BE(this.credentialId.length)

    const authData = Buffer.concat([
      this.header(flags),
      Buffer.alloc(16), // aaguid
      idLength,
      this.credentialId,
      this.coseKey()
    ])

    const attestationObject = cbor(
      new Map<number | string, CborValue>([
        ['fmt', 'none'],
        ['attStmt', new Map()],
        ['authData', authData]
      ])
    )

    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key' as const,
      authenticatorAttachment: 'platform' as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64url(
          this.clientData('webauthn.create', options.challenge, overrides)
        ),
        attestationObject: b64url(attestationObject),
        transports: ['internal' as const]
      }
    }
  }

  /** Build a navigator.credentials.get() response for the given options. */
  assert(options: RequestOptionsLike, overrides: AssertionOverrides = {}) {
    this.counter = overrides.counter ?? this.counter + 1
    const flags = FLAG_UP | (overrides.userVerified === false ? 0 : FLAG_UV)

    const authData = this.header(flags)
    const clientDataJSON = this.clientData(
      'webauthn.get',
      options.challenge,
      overrides
    )

    const signingKey = overrides.signWithWrongKey
      ? generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey
      : this.privateKey
    const signature = sign(
      'sha256',
      Buffer.concat([authData, sha256(clientDataJSON)]),
      signingKey
    )

    const id = overrides.credentialId ?? this.id
    return {
      id,
      rawId: id,
      type: 'public-key' as const,
      authenticatorAttachment: 'platform' as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64url(clientDataJSON),
        authenticatorData: b64url(authData),
        signature: b64url(signature)
      }
    }
  }
}
