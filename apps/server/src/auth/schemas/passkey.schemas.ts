import { z } from 'zod'

const authenticatorTransportSchema = z.enum([
  'ble',
  'cable',
  'hybrid',
  'internal',
  'nfc',
  'smart-card',
  'usb'
])

const registrationResponseSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal('public-key'),
  clientExtensionResults: z.record(z.string(), z.unknown()).optional().default({}),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  response: z.object({
    clientDataJSON: z.string().min(1),
    attestationObject: z.string().min(1),
    authenticatorData: z.string().optional(),
    transports: z.array(authenticatorTransportSchema).optional(),
    publicKeyAlgorithm: z.number().optional(),
    publicKey: z.string().optional()
  })
})

const authenticationResponseSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal('public-key'),
  clientExtensionResults: z.record(z.string(), z.unknown()).optional().default({}),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  response: z.object({
    clientDataJSON: z.string().min(1),
    authenticatorData: z.string().min(1),
    signature: z.string().min(1),
    userHandle: z.string().optional()
  })
})

export const passkeyRegisterOptionsSchema = z.object({}).strict()

export const passkeyRegisterVerifySchema = z.object({
  credential: registrationResponseSchema,
  name: z.string().trim().min(1).max(64).optional()
})

export const passkeyLoginOptionsSchema = z.object({
  email: z
    .email()
    .transform(value => value.trim().toLowerCase())
    .optional()
})

export const passkeyLoginVerifySchema = z.object({
  credential: authenticationResponseSchema
})

export type PasskeyRegisterVerifyBody = z.infer<
  typeof passkeyRegisterVerifySchema
>
export type PasskeyLoginOptionsBody = z.infer<typeof passkeyLoginOptionsSchema>
export type PasskeyLoginVerifyBody = z.infer<typeof passkeyLoginVerifySchema>
