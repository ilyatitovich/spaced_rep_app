import { z } from 'zod'

export const googleCallbackSchema = z.object({
  code: z.string().min(1),
  codeVerifier: z.string().min(43).max(128),
  redirectUri: z.string().url()
})

export type GoogleCallbackBody = z.infer<typeof googleCallbackSchema>
