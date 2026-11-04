import { z } from 'zod'

const BackupTopicSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  pivot: z.number(),
  week: z.array(z.unknown()),
  nextUpdateDate: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
  isArchived: z.boolean().optional()
})

const BackupCardSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  level: z.number(),
  data: z.unknown(),
  updatedAt: z.number(),
  reviewDate: z.number().optional()
})

export const BackupFileSchema = z.object({
  version: z.number().optional(),
  exportedAt: z.string().optional(),
  topics: z.array(BackupTopicSchema),
  cards: z.array(BackupCardSchema)
})

export type BackupFile = z.infer<typeof BackupFileSchema>
