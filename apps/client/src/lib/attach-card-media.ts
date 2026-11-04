import { toast } from 'react-hot-toast'

import { blobToRecord, processImage } from '@/lib/image'
import {
  mediaValidationMessage,
  validateCardMediaFile,
  type MediaKind
} from '@/lib/validate-card-media'
import type { SideBlock } from '@/types'

/** Validate + convert a picked/dropped/pasted file into a media SideBlock. */
export async function attachCardMediaFile(
  file: File,
  expect?: MediaKind
): Promise<SideBlock | null> {
  const result = validateCardMediaFile(file, expect)
  if (!result.ok) {
    toast.error(mediaValidationMessage(result))
    return null
  }

  try {
    if (result.kind === 'image') {
      const record = await blobToRecord(await processImage(file))
      return { type: 'image', content: record }
    }
    const buffer = await file.arrayBuffer()
    return { type: 'audio', content: { buffer, type: result.type } }
  } catch (err) {
    console.error('Failed to attach media:', err)
    toast.error(
      result.kind === 'image'
        ? 'Couldn’t process that image. Try another file.'
        : 'Couldn’t process that audio. Try another file.'
    )
    return null
  }
}
