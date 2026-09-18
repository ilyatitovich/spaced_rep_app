import {
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '../config/env.js'

export const PRESIGN_EXPIRES_IN_SECONDS = 5 * 60

export type R2StorageConfig = {
  bucket: string
  region: string
  endpoint: string
  /** Hostname used when signing browser-facing URLs (MinIO localhost). */
  presignEndpoint?: string
  forcePathStyle: boolean
  accessKeyId: string
  secretAccessKey: string
  presignExpiresInSeconds?: number
}

export type ObjectHead = {
  contentLength: number | undefined
  contentType: string | undefined
  /** Base64 SHA-256 digest when the store returned checksum metadata. */
  checksumSHA256: string | undefined
}

export type PresignedPut = {
  url: string
  headers: {
    'content-type': string
    'x-amz-checksum-sha256': string
  }
}

export type R2Storage = {
  bucket: string
  objectKey: (userId: string, hashHex: string) => string
  headObject: (key: string) => Promise<ObjectHead | null>
  putObject: (input: {
    key: string
    body: Uint8Array
    contentType: string
    checksumSHA256Hex: string
  }) => Promise<void>
  presignPut: (input: {
    key: string
    contentType: string
    checksumSHA256Hex: string
  }) => Promise<PresignedPut>
  presignGet: (key: string) => Promise<string>
}

/** Lowercase hex SHA-256 → base64 digest for `x-amz-checksum-sha256`. */
export function sha256HexToBase64(hex: string): string {
  return Buffer.from(hex, 'hex').toString('base64')
}

export function mediaObjectKey(userId: string, hashHex: string): string {
  return `${userId}/${hashHex}`
}

function createClient(
  config: R2StorageConfig,
  endpoint: string
): S3Client {
  const clientConfig: S3ClientConfig = {
    region: config.region,
    endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    // Avoid flexible CRC checksums that break R2/MinIO; we set SHA-256 explicitly.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED'
  }
  return new S3Client(clientConfig)
}

export function createR2Storage(config: R2StorageConfig): R2Storage {
  const expiresIn =
    config.presignExpiresInSeconds ?? PRESIGN_EXPIRES_IN_SECONDS
  const apiClient = createClient(config, config.endpoint)
  const presignClient = createClient(
    config,
    config.presignEndpoint ?? config.endpoint
  )

  return {
    bucket: config.bucket,
    objectKey: mediaObjectKey,

    async headObject(key) {
      try {
        const result = await apiClient.send(
          new HeadObjectCommand({
            Bucket: config.bucket,
            Key: key,
            ChecksumMode: 'ENABLED'
          })
        )
        return {
          contentLength: result.ContentLength,
          contentType: result.ContentType,
          checksumSHA256: result.ChecksumSHA256
        }
      } catch (err) {
        if (
          err instanceof NotFound ||
          (err as { name?: string }).name === 'NotFound' ||
          (err as { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode === 404
        ) {
          return null
        }
        throw err
      }
    },

    async putObject(input) {
      const checksumSHA256 = sha256HexToBase64(input.checksumSHA256Hex)
      await apiClient.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          ChecksumSHA256: checksumSHA256,
          ChecksumAlgorithm: 'SHA256'
        })
      )
    },

    async presignPut(input) {
      const checksumSHA256 = sha256HexToBase64(input.checksumSHA256Hex)
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: input.key,
        ContentType: input.contentType,
        ChecksumSHA256: checksumSHA256,
        ChecksumAlgorithm: 'SHA256'
      })
      const url = await getSignedUrl(presignClient, command, {
        expiresIn,
        signableHeaders: new Set(['content-type']),
        unhoistableHeaders: new Set(['x-amz-checksum-sha256'])
      })
      return {
        url,
        headers: {
          'content-type': input.contentType,
          'x-amz-checksum-sha256': checksumSHA256
        }
      }
    },

    async presignGet(key) {
      return getSignedUrl(
        presignClient,
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: key
        }),
        { expiresIn }
      )
    }
  }
}

export function resolveR2EndpointFromEnv(): string | null {
  if (env.R2_ENDPOINT) return env.R2_ENDPOINT
  if (env.R2_ACCOUNT_ID) {
    return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  }
  return null
}

export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      resolveR2EndpointFromEnv()
  )
}

export function createR2StorageFromEnv(
  overrides: Partial<R2StorageConfig> = {}
): R2Storage {
  const endpoint = overrides.endpoint ?? resolveR2EndpointFromEnv()
  if (
    !endpoint ||
    !(overrides.accessKeyId ?? env.R2_ACCESS_KEY_ID) ||
    !(overrides.secretAccessKey ?? env.R2_SECRET_ACCESS_KEY)
  ) {
    throw new Error('R2/MinIO storage is not configured')
  }

  return createR2Storage({
    bucket: overrides.bucket ?? env.R2_BUCKET,
    region: overrides.region ?? env.R2_REGION,
    endpoint,
    presignEndpoint:
      overrides.presignEndpoint ?? (env.R2_PRESIGN_ENDPOINT || undefined),
    forcePathStyle: overrides.forcePathStyle ?? env.R2_FORCE_PATH_STYLE,
    accessKeyId: overrides.accessKeyId ?? env.R2_ACCESS_KEY_ID,
    secretAccessKey: overrides.secretAccessKey ?? env.R2_SECRET_ACCESS_KEY,
    presignExpiresInSeconds: overrides.presignExpiresInSeconds
  })
}
