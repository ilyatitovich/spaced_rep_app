const levelDescription: Record<string, string> = {
  0: 'Cards with only one side are served as drafts. You can also move cards to drafts if you are not ready to review them.',
  1: 'New cards are added to level 1. When you review a card, and get it right, it moves up one level. When you review a card, and get it wrong, it moved back to level 1.',
  2: `When you review a card, and get it right, it moves up one level. When you review a card, and get it wrong, it moved back to level 1.
  It might seems as if cards you got wrong stayed at level 2. That is only because the test repeats all level 1 card until you get the right.`,
  general:
    'When you review a card, and get it right, it moves up one level. When you review a card, and get it wrong, it moved back to level 1.',
  7: 'When you review a card, and get it right, it moves to finished cards. When you review a card, and get it wrong, it moved back to level 1.',
  8: 'When you have moved a card through all 7 levels they ara marked as finished. Finished cards are not shown in the test. If you want to review them again you can move them to another level.'
}

export function getLevelDescription(levelId: string): string {
  const levelNum = Number(levelId)

  if (!Number.isFinite(levelNum)) {
    console.warn(`getLevelDescription: invalid levelId "${levelId}"`)
    return ''
  }

  // Normalize to general
  const normalizedKey =
    levelNum > 2 && levelNum < 7 ? 'general' : String(levelNum)

  // Safe access
  const description = levelDescription[normalizedKey]

  if (!description) {
    console.warn(`No description found for level "${normalizedKey}"`)
    return ''
  }

  return description
}
