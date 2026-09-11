import JSZip from 'jszip'
import type { Database, SqlJsStatic } from 'sql.js'

export type AnkiMediaFile = {
  buffer: ArrayBuffer
  type: string
}

export type ParsedAnkiNote = {
  fields: string[]
  /** Parallel to `fields`; empty when the note type is unknown. */
  fieldNames: string[]
}

export type ParsedApkg = {
  notes: ParsedAnkiNote[]
  /** Original Anki media filename → file bytes */
  mediaByName: Map<string, AnkiMediaFile>
}

const FIELD_SEP = '\x1f'
const DUMMY_NOTE_MARKER =
  'Please update to the latest Anki version, then import the .colpkg/.apkg file again.'

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
    case 'svg':
      return 'image/svg+xml'
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
  zip: JSZip
): Promise<Map<string, AnkiMediaFile>> {
  const mediaFile = zip.file('media')
  if (!mediaFile) return new Map()

  const text = await mediaFile.async('string')
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
    mediaByName.set(name, { buffer, type: mimeFromName(name) })
  }

  return mediaByName
}

function readFieldNamesByMid(db: Database): Map<number, string[]> {
  try {
    const result = db.exec('SELECT models FROM col')
    if (!result.length) return new Map()
    const raw = result[0].values[0]?.[0]
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
    if (!result.length) return []

    const midCol = result[0].columns.indexOf('mid')
    const fldsCol = result[0].columns.indexOf('flds')
    if (fldsCol < 0) return []

    return result[0].values
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
  const zip = await JSZip.loadAsync(buffer)
  const names = new Set(Object.keys(zip.files).map(n => n.replace(/^\.\//, '')))

  const collectionName = pickCollectionName(names)
  const collection = zip.file(collectionName)
  if (!collection) {
    throw new Error(`Invalid .apkg: missing ${collectionName}`)
  }

  const [SQL, dbBytes, mediaByName] = await Promise.all([
    loadSql(),
    collection.async('uint8array'),
    readMediaMap(zip)
  ])

  return {
    notes: readNotes(dbBytes, SQL),
    mediaByName
  }
}
