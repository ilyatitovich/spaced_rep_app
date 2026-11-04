import JSZip from 'jszip'
import type { Database, SqlJsStatic } from 'sql.js'

export interface AnkiMediaFile {
  buffer: ArrayBuffer
  type: string
}

export interface ParsedAnkiNote {
  fields: string[]
  /** Parallel to `fields`; empty when the note type is unknown. */
  fieldNames: string[]
}

export interface ParsedApkg {
  notes: ParsedAnkiNote[]
  /** Original Anki media filename → file bytes */
  mediaByName: Map<string, AnkiMediaFile>
}

const FIELD_SEP = '\x1f'
const DUMMY_NOTE_MARKER =
  'Please update to the latest Anki version, then import the .colpkg/.apkg file again.'

/** Mutable so tests can temporarily tighten caps without DI. */
export const APKG_LIMITS = {
  maxCompressedBytes: 100 * 1024 * 1024,
  maxZipEntries: 20_000,
  maxUncompressedBytes: 500 * 1024 * 1024
}

export function assertApkgCompressedSize(byteLength: number): void {
  if (byteLength > APKG_LIMITS.maxCompressedBytes) {
    throw new Error(
      `This .apkg is too large (max ${Math.floor(APKG_LIMITS.maxCompressedBytes / (1024 * 1024))} MB).`
    )
  }
}

export function assertApkgEntryCount(entryCount: number): void {
  if (entryCount > APKG_LIMITS.maxZipEntries) {
    throw new Error(
      `This .apkg has too many files (max ${APKG_LIMITS.maxZipEntries}).`
    )
  }
}

function trackUncompressed(total: { bytes: number }, add: number): void {
  total.bytes += add
  if (total.bytes > APKG_LIMITS.maxUncompressedBytes) {
    throw new Error(
      `This .apkg expands to more than ${Math.floor(APKG_LIMITS.maxUncompressedBytes / (1024 * 1024))} MB uncompressed.`
    )
  }
}

let sqlReady: Promise<SqlJsStatic> | undefined

function loadSql(): Promise<SqlJsStatic> {
  // ponytail: asm build avoids wasm locateFile; dynamic import keeps it off the critical path
  sqlReady ??= import('sql.js/dist/sql-asm.js').then(m => m.default())
  return sqlReady
}

function mimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'mp3':
      return 'audio/mpeg'
    case 'ogg':
    case 'oga':
      return 'audio/ogg'
    case 'wav':
      return 'audio/wav'
    case 'm4a':
      return 'audio/mp4'
    default:
      return 'application/octet-stream'
  }
}

/** Prefer real deck DB over the legacy compatibility stub. */
function pickCollectionName(names: Set<string>): string {
  if (names.has('collection.anki21')) return 'collection.anki21'
  if (names.has('collection.anki2')) return 'collection.anki2'
  if (names.has('collection.anki21b')) {
    throw new Error(
      'This .apkg uses the modern Anki format (collection.anki21b). Re-export with “Support older Anki versions” enabled.'
    )
  }
  throw new Error('Invalid .apkg: missing collection database')
}

/**
 * Media JSON is usually `{ "0": "photo.jpg" }` (zip index → name).
 * Some older tools invert that; accept both.
 */
function nameToZipIndex(raw: Record<string, string>): Map<string, string> {
  const entries = Object.entries(raw)
  if (entries.length === 0) return new Map()

  const keysAreIndexes = entries.every(([key]) => /^\d+$/.test(key))
  if (keysAreIndexes) {
    return new Map(entries.map(([index, name]) => [name, index]))
  }
  return new Map(entries)
}

async function readMediaMap(
  zip: JSZip,
  uncompressed: { bytes: number }
): Promise<Map<string, AnkiMediaFile>> {
  const mediaFile = zip.file('media')
  if (!mediaFile) return new Map()

  const text = await mediaFile.async('string')
  trackUncompressed(uncompressed, text.length)
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error(
      'This .apkg uses a binary media map. Re-export with “Support older Anki versions” enabled.'
    )
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return new Map()
  }

  const indexByName = nameToZipIndex(raw as Record<string, string>)
  const mediaByName = new Map<string, AnkiMediaFile>()

  for (const [name, index] of indexByName) {
    const entry = zip.file(index)
    if (!entry) continue
    const buffer = await entry.async('arraybuffer')
    trackUncompressed(uncompressed, buffer.byteLength)
    mediaByName.set(name, { buffer, type: mimeFromName(name) })
  }

  return mediaByName
}

function readFieldNamesByMid(db: Database): Map<number, string[]> {
  try {
    const result = db.exec('SELECT models FROM col')
    const first = result[0]
    if (!first) return new Map()
    const raw = first.values[0]?.[0]
    if (typeof raw !== 'string') return new Map()

    const models = JSON.parse(raw) as Record<
      string,
      { flds?: Array<{ name?: string }> }
    >
    const map = new Map<number, string[]>()
    for (const [id, model] of Object.entries(models)) {
      if (!Array.isArray(model.flds)) continue
      map.set(
        Number(id),
        model.flds.map(f => (typeof f.name === 'string' ? f.name : ''))
      )
    }
    return map
  } catch {
    return new Map()
  }
}

function readNotes(dbBytes: Uint8Array, SQL: SqlJsStatic): ParsedAnkiNote[] {
  const db = new SQL.Database(dbBytes)
  try {
    const fieldNamesByMid = readFieldNamesByMid(db)
    const result = db.exec('SELECT mid, flds FROM notes')
    const first = result[0]
    if (!first) return []

    const midCol = first.columns.indexOf('mid')
    const fldsCol = first.columns.indexOf('flds')
    if (fldsCol < 0) return []

    return first.values
      .map(row => {
        const flds = row[fldsCol]
        if (typeof flds !== 'string') return null
        if (flds.includes(DUMMY_NOTE_MARKER)) return null
        const fields = flds.split(FIELD_SEP)
        const mid = midCol >= 0 ? Number(row[midCol]) : NaN
        return {
          fields,
          fieldNames: fieldNamesByMid.get(mid) ?? []
        }
      })
      .filter((note): note is ParsedAnkiNote => note !== null)
  } finally {
    db.close()
  }
}

/** Unzip an `.apkg` and return notes + media (no Card mapping). */
export async function parseApkg(
  data: ArrayBuffer | Blob | File
): Promise<ParsedApkg> {
  const buffer = data instanceof ArrayBuffer ? data : await data.arrayBuffer()
  assertApkgCompressedSize(buffer.byteLength)

  const zip = await JSZip.loadAsync(buffer)
  const entryNames = Object.keys(zip.files)
  assertApkgEntryCount(entryNames.length)

  const names = new Set(entryNames.map(n => n.replace(/^\.\//, '')))
  const uncompressed = { bytes: 0 }

  const collectionName = pickCollectionName(names)
  const collection = zip.file(collectionName)
  if (!collection) {
    throw new Error(`Invalid .apkg: missing ${collectionName}`)
  }

  const [SQL, dbBytes, mediaByName] = await Promise.all([
    loadSql(),
    collection.async('uint8array').then(bytes => {
      trackUncompressed(uncompressed, bytes.byteLength)
      return bytes
    }),
    readMediaMap(zip, uncompressed)
  ])

  return {
    notes: readNotes(dbBytes, SQL),
    mediaByName
  }
}
