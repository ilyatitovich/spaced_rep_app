import { z } from 'zod'

export const upsertSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512)
  }),
  deviceId: z.uuid().optional()
})

export const deleteSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048)
})

export type UpsertSubscriptionBody = z.infer<typeof upsertSubscriptionSchema>
export type DeleteSubscriptionBody = z.infer<typeof deleteSubscriptionSchema>
