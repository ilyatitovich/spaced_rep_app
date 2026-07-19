import { z } from 'zod'

export const emailRequestSchema = z.object({
  email: z.email().transform(value => value.trim().toLowerCase()),
  turnstileToken: z.string().min(1)
})

export const emailVerifySchema = z.object({
  email: z.email().transform(value => value.trim().toLowerCase()),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits')
})

export type EmailRequestBody = z.infer<typeof emailRequestSchema>
export type EmailVerifyBody = z.infer<typeof emailVerifySchema>
