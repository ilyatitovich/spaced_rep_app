/**
 * Client allowlist / size caps — keep in sync with
 * apps/server/src/sync/media.service.ts (MAX_*_BYTES, ALLOWED_MEDIA_TYPES).
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024

const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp'
])

const AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/mp4'
])

/** Extension → MIME when the browser leaves `file.type` empty. */
const EXT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.aac': 'audio/mp4'
}

export type MediaKind = 'image' | 'audio'

export interface ValidateOk {
  ok: true
  kind: MediaKind
  type: string
}
export interface ValidateErr {
  ok: false
  reason: 'empty' | 'too_large' | 'unsupported' | 'wrong_kind'
}
export type ValidateResult = ValidateOk | ValidateErr

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i).toLowerCase()
}

function resolveType(file: File): string | null {
  const declared = file.type.trim().toLowerCase()
  if (declared === 'image/svg+xml') return null
  if (IMAGE_TYPES.has(declared) || AUDIO_TYPES.has(declared)) return declared

  const ext = extOf(file.name)
  if (ext === '.svg') return null
  if (!declared) return EXT_TYPES[ext] ?? null
  return null
}

function kindOf(type: string): MediaKind {
  return type.startsWith('image/') ? 'image' : 'audio'
}

export function validateCardMediaFile(
  file: File,
  expect?: MediaKind
): ValidateResult {
  if (file.size <= 0) return { ok: false, reason: 'empty' }

  const type = resolveType(file)
  if (!type) return { ok: false, reason: 'unsupported' }

  const kind = kindOf(type)
  if (expect && kind !== expect) return { ok: false, reason: 'wrong_kind' }

  const max = kind === 'image' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES
  if (file.size > max) return { ok: false, reason: 'too_large' }

  return { ok: true, kind, type }
}

export function mediaValidationMessage(err: ValidateErr): string {
  switch (err.reason) {
    case 'empty':
      return 'That file is empty.'
    case 'too_large':
      return 'That file is too large.'
    case 'unsupported':
      return 'That file format isn’t supported.'
    case 'wrong_kind':
      return 'Drop an image or audio file of the expected type.'
  }
}

/** Non-empty File entries from a drop DataTransfer. */
export function mediaFilesFromDataTransfer(dt: DataTransfer): File[] {
  return [...dt.files].filter(f => f.size > 0)
}
