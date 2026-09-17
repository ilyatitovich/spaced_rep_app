import { z } from 'zod'

export const extensionGrantSchema = z.object({
  redirectUri: z.string().url(),
  state: z.string().min(16).max(256),
  codeChallenge: z.string().min(43).max(128)
})

export const extensionTokenSchema = z.object({
  code: z.string().min(32).max(256),
  codeVerifier: z.string().min(43).max(128),
  redirectUri: z.string().url()
})
