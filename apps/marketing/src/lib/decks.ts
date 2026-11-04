import attentionHabits from '../data/decks/attention-habits.json'
import learningScience from '../data/decks/learning-science.json'
import spacedRepBasics from '../data/decks/spaced-rep-basics.json'

export interface DeckCard {
  front: string
  back: string
}

export interface Deck {
  slug: string
  title: string
  description: string
  tags: string[]
  cards: DeckCard[]
}

const decks: Deck[] = [spacedRepBasics, learningScience, attentionHabits]

export function getAllDecks(): Deck[] {
  return decks
}

export function getDeck(slug: string): Deck | undefined {
  return decks.find(deck => deck.slug === slug)
}

export function deckCardCount(deck: Deck): number {
  return deck.cards.length
}
