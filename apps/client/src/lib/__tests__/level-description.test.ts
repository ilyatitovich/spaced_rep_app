import { describe, expect, it } from 'vitest'

import { getLevelDescription, levelLabel } from '@/lib/level-description'

describe('levelLabel', () => {
  it('names draft, numbered, and finished levels', () => {
    expect(levelLabel(0)).toBe('Draft')
    expect(levelLabel(3)).toBe('Level 3')
    expect(levelLabel(8)).toBe('Finished')
  })
})

describe('getLevelDescription', () => {
  it('uses present-tense copy without typos', () => {
    expect(getLevelDescription('1')).toContain('it moves back to level 1')
    expect(getLevelDescription('1')).not.toContain('it moved back')
    expect(getLevelDescription('8')).toContain('they are marked as finished')
    expect(getLevelDescription('8')).not.toContain('ara marked')
  })

  it('shares mid-level copy through the general key', () => {
    expect(getLevelDescription('4')).toBe(getLevelDescription('2'))
  })
})
