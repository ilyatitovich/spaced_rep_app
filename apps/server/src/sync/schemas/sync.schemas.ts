import { z } from 'zod'

export const revokeDeviceSchema = z
  .object({
    deviceId: z.uuid(),
    currentDeviceId: z.uuid()
  })
  .strict()

export type RevokeDeviceBody = z.infer<typeof revokeDeviceSchema>
