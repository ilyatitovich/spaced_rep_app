import { z } from 'zod'

const deviceIdSchema = z.uuid()
const updatedAtSchema = z.number().int().nonnegative()

const timeLocalSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Invalid timeLocal (HH:mm)')

const timezoneSchema = z.string().min(1).max(64)
const languageSchema = z.string().min(2).max(35)

export const reminderSchema = z.object({
  id: z.uuid(),
  timeLocal: timeLocalSchema,
  daysOfWeek: z.number().int().min(0).max(127),
  channel: z.enum(['push', 'email']),
  enabled: z.boolean(),
  sortOrder: z.number().int(),
  updatedAt: updatedAtSchema
})

export const patchPreferencesSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    language: languageSchema.optional(),
    timezone: timezoneSchema.optional(),
    updatedAt: updatedAtSchema,
    deviceId: deviceIdSchema
  })
  .refine(
    data =>
      data.theme !== undefined ||
      data.language !== undefined ||
      data.timezone !== undefined,
    { message: 'At least one preference field is required' }
  )

export const patchLearningSchema = z
  .object({
    weekStartsOn: z.number().int().min(0).max(6).optional(),
    dailyNewCardLimit: z.number().int().positive().nullable().optional(),
    updatedAt: updatedAtSchema,
    deviceId: deviceIdSchema
  })
  .refine(
    data =>
      data.weekStartsOn !== undefined || data.dailyNewCardLimit !== undefined,
    { message: 'At least one learning field is required' }
  )

export const patchNotificationsSchema = z
  .object({
    enabled: z.boolean().optional(),
    timezone: timezoneSchema.optional(),
    reminders: z.array(reminderSchema).optional(),
    updatedAt: updatedAtSchema,
    deviceId: deviceIdSchema
  })
  .refine(
    data =>
      data.enabled !== undefined ||
      data.timezone !== undefined ||
      data.reminders !== undefined,
    { message: 'At least one notification field is required' }
  )

export const putRemindersSchema = z.object({
  reminders: z.array(reminderSchema),
  updatedAt: updatedAtSchema,
  deviceId: deviceIdSchema
})

export type PatchPreferencesBody = z.infer<typeof patchPreferencesSchema>
export type PatchLearningBody = z.infer<typeof patchLearningSchema>
export type PatchNotificationsBody = z.infer<typeof patchNotificationsSchema>
export type PutRemindersBody = z.infer<typeof putRemindersSchema>
