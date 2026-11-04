import { z } from 'zod'
import { isPushEndpointAllowed } from '../lib/push-endpoint.js'

const pushEndpoint = z.string().url().max(2048).refine(isPushEndpointAllowed, {
  message: 'Push endpoint host is not allowed'
})

export const upsertSubscriptionSchema = z.object({
  endpoint: pushEndpoint,
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512)
  }),
  deviceId: z.uuid().optional()
})

export const deleteSubscriptionSchema = z.object({
  endpoint: pushEndpoint
})

export type UpsertSubscriptionBody = z.infer<typeof upsertSubscriptionSchema>
export type DeleteSubscriptionBody = z.infer<typeof deleteSubscriptionSchema>
