import { describe, expect, it } from 'vitest'

import { parseImportJson } from '../parse-import-json'

describe('parseImportJson', () => {
  it('parses plain JSON', () => {
    expect(parseImportJson('{"cards":[]}')).toEqual({ cards: [] })
  })

  it('strips markdown json fences', () => {
    expect(parseImportJson('```json\n{"cards":[]}\n```')).toEqual({
      cards: []
    })
  })

  it('strips bare markdown fences', () => {
    expect(parseImportJson('```\n{"version":1}\n```')).toEqual({ version: 1 })
  })

  it('reads a fenced json block when an LLM wraps it in prose', () => {
    expect(
      parseImportJson('Here you go:\n```json\n{"version":1}\n```\nEnjoy!')
    ).toEqual({ version: 1 })
  })

  it('keeps backticks that belong inside JSON strings', () => {
    expect(parseImportJson('{"code":"```json"}')).toEqual({ code: '```json' })
  })

  it('throws when leftover text is not valid JSON', () => {
    expect(() => parseImportJson('```json\nnot json\n```')).toThrow(
      'Invalid JSON'
    )
  })
})
