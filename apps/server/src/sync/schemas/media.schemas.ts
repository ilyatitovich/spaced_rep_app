import { z } from 'zod'
import { MAX_MEDIA_ITEMS } from '../media.service.js'

export const mediaUploadItemSchema = z
  .object({
    hash: z.string(),
    type: z.string().min(1),
    byteLength: z.number().int().positive(),
    checksum: z.string().min(1)
  })
  .strict()

export const mediaUploadsBodySchema = z
  .object({
    items: z.array(mediaUploadItemSchema).max(MAX_MEDIA_ITEMS)
  })
  .strict()

export const mediaDownloadsBodySchema = z
  .object({
    hashes: z.array(z.string()).max(MAX_MEDIA_ITEMS)
  })
  .strict()

export type MediaUploadsBody = z.infer<typeof mediaUploadsBodySchema>
export type MediaDownloadsBody = z.infer<typeof mediaDownloadsBodySchema>
