import initSqlJs from 'sql.js/dist/sql-asm.js'
import JSZip from 'jszip'
import { parseApkg } from '@/lib/anki/parse-apkg'
import {
  apkgToCards,
  fieldHtmlToBlocks,
  noteFieldsToCardData,
  pickFrontBackHtml
} from '@/lib/anki/to-card-data'

const FIELD_SEP = '\x1f'

async function buildApkg(options: {
  notes: string[][]
  media?: Record<string, { bytes: Uint8Array; name: string }>
  fieldNames?: string[]
}): Promise<ArrayBuffer> {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run(
    'CREATE TABLE col (id INTEGER PRIMARY KEY, models TEXT NOT NULL)'
  )
  db.run(
    'CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER NOT NULL, flds TEXT NOT NULL)'
  )

  const fieldNames = options.fieldNames ?? ['Front', 'Back']
  const mid = 1
  db.run('INSERT INTO col (id, models) VALUES (1, ?)', [
    JSON.stringify({
      [mid]: {
        name: 'Test',
        flds: fieldNames.map(name => ({ name }))
      }
    })
  ])

  options.notes.forEach((fields, i) => {
    db.run('INSERT INTO notes (id, mid, flds) VALUES (?, ?, ?)', [
      i + 1,
      mid,
      fields.join(FIELD_SEP)
    ])
  })
  const dbBytes = db.export()
  db.close()

  const zip = new JSZip()
  zip.file('collection.anki21', dbBytes)

  const mediaJson: Record<string, string> = {}
  if (options.media) {
    let index = 0
    for (const file of Object.values(options.media)) {
      mediaJson[String(index)] = file.name
      zip.file(String(index), file.bytes)
      index += 1
    }
  }
  zip.file('media', JSON.stringify(mediaJson))

  return zip.generateAsync({ type: 'arraybuffer' })
}

describe('fieldHtmlToBlocks', () => {
  it('extracts images and sound tags in document order', () => {
    const png = new ArrayBuffer(4)
    const mp3 = new ArrayBuffer(8)
    const media = new Map([
      ['pic.png', { buffer: png, type: 'image/png' }],
      ['a.mp3', { buffer: mp3, type: 'audio/mpeg' }]
    ])

    expect(
      fieldHtmlToBlocks(
        'Hello <img src="pic.png"> world [sound:a.mp3] end',
        media
      )
    ).toEqual([
      { type: 'text', html: 'Hello ' },
      { type: 'image', content: { buffer: png, type: 'image/png' } },
      { type: 'text', html: ' world ' },
      { type: 'audio', content: { buffer: mp3, type: 'audio/mpeg' } },
      { type: 'text', html: ' end' }
    ])
  })

  it('keeps remote http(s) and protocol-relative img urls as { src }', () => {
    expect(
      fieldHtmlToBlocks(
        '<img src="http://i.imgur.com/a.png"><img src="https://cdn.example/b.jpg"><img src="//cdn.example/c.webp">',
        new Map()
      )
    ).toEqual([
      {
        type: 'image',
        content: { src: 'http://i.imgur.com/a.png' }
      },
      {
        type: 'image',
        content: { src: 'https://cdn.example/b.jpg' }
      },
      {
        type: 'image',
        content: { src: '//cdn.example/c.webp' }
      }
    ])
  })

  it('keeps missing local image filenames as text', () => {
    expect(
      fieldHtmlToBlocks('<img src="missing.png">', new Map())
    ).toEqual([{ type: 'text', html: 'missing.png' }])
  })
})

describe('pickFrontBackHtml', () => {
  it('uses Front/Back field names', () => {
    expect(
      pickFrontBackHtml(['Q', 'A'], ['Front', 'Back'])
    ).toEqual({ front: 'Q', back: 'A' })
  })

  it('maps cloze Question decks instead of Id/Category', () => {
    const { front, back } = pickFrontBackHtml(
      [
        '0557',
        'Present perfect and past 1',
        'Unit 7',
        'Complete the sentences.',
        "She's {{c1::taking}} a picture.",
        'crossing / taking',
        '<img src="x.jpg">',
        '',
        ''
      ],
      [
        'Id',
        'Category',
        'Unit',
        'Rubric',
        'Question',
        'Choices',
        'Image',
        'Audio',
        'AudioText'
      ]
    )

    expect(front).not.toContain('0557')
    expect(front).not.toContain('Present perfect')
    expect(front).toContain('Complete the sentences.')
    expect(front).toContain("She's ___ a picture.")
    expect(front).toContain('crossing / taking')
    expect(front).toContain('<img src="x.jpg">')
    expect(back).toContain("She's taking a picture.")
  })
})

describe('parseApkg + apkgToCards', () => {
  it('maps Basic + image + sound notes to Draft (level 0) cards', async () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71])
    const mp3Bytes = new Uint8Array([1, 2, 3, 4])

    const apkg = await buildApkg({
      notes: [
        [
          'Front <img src="photo.png">',
          'Back [sound:clip.mp3] <b>ok</b>'
        ]
      ],
      media: {
        photo: { bytes: pngBytes, name: 'photo.png' },
        clip: { bytes: mp3Bytes, name: 'clip.mp3' }
      }
    })

    const parsed = await parseApkg(apkg)
    expect(parsed.notes).toHaveLength(1)
    expect(parsed.notes[0].fieldNames).toEqual(['Front', 'Back'])
    expect(parsed.mediaByName.get('photo.png')?.type).toBe('image/png')
    expect(parsed.mediaByName.get('clip.mp3')?.type).toBe('audio/mpeg')

    const cards = apkgToCards(parsed, 'topic-1')
    expect(cards).toHaveLength(1)
    expect(cards[0].topicId).toBe('topic-1')
    expect(cards[0].level).toBe(0)
    expect(cards[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )

    const data = noteFieldsToCardData(
      parsed.notes[0].fields,
      parsed.mediaByName,
      parsed.notes[0].fieldNames
    )
    expect(data.front.blocks[0]).toMatchObject({ type: 'text' })
    expect(data.front.blocks.some(b => b.type === 'image')).toBe(true)
    expect(data.back.blocks.some(b => b.type === 'audio')).toBe(true)
    expect(
      data.back.blocks.some(
        b => b.type === 'text' && b.html.includes('<b>')
      )
    ).toBe(true)
  })

  it('prefers collection.anki21 over a dummy collection.anki2', async () => {
    const SQL = await initSqlJs()
    const real = new SQL.Database()
    real.run(
      'CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, flds TEXT NOT NULL)'
    )
    real.run('INSERT INTO notes (id, mid, flds) VALUES (1, 1, ?)', [
      `Real front${FIELD_SEP}Real back`
    ])
    const realBytes = real.export()
    real.close()

    const dummy = new SQL.Database()
    dummy.run(
      'CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, flds TEXT NOT NULL)'
    )
    dummy.run('INSERT INTO notes (id, mid, flds) VALUES (1, 1, ?)', [
      'Please update to the latest Anki version, then import the .colpkg/.apkg file again.'
    ])
    const dummyBytes = dummy.export()
    dummy.close()

    const zip = new JSZip()
    zip.file('collection.anki21', realBytes)
    zip.file('collection.anki2', dummyBytes)
    zip.file('media', '{}')
    const buf = await zip.generateAsync({ type: 'arraybuffer' })

    const parsed = await parseApkg(buf)
    expect(parsed.notes).toEqual([
      { fields: ['Real front', 'Real back'], fieldNames: [] }
    ])
  })
})
