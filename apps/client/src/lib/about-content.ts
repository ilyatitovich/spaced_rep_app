export type AboutSection = {
  title: string
  body: string
}

export const ABOUT_SECTIONS: AboutSection[] = [
  {
    title: 'What this app is',
    body: 'SpacedRepApp is a flashcard study tool that helps you remember what you learn. You organize cards into topics, review them in short sessions, and the app schedules the next review so knowledge sticks over time — without cramming.'
  },
  {
    title: 'How studying works',
    body: 'New cards start at level 1. When you remember a card, it moves up a level and comes back less often. When you forget it, it returns to level 1 so you can rebuild the memory. After you work through all seven levels, a card is marked finished and leaves your regular reviews — you can always move it back if you want another pass.'
  },
  {
    title: 'Offline & sync',
    body: 'Your topics and cards live on this device, so you can study without a connection. Sign in when you want cloud sync across devices, or use import and export under Data & Sync to move a backup yourself.'
  },
  {
    title: 'Inspiration',
    body: 'The review schedule is inspired by Nicky Case’s interactive explainer “How to remember anything forever-ish,” which shows why spacing practice works better than massed repetition.'
  }
]

export const ABOUT_FOOTER =
  'Made for everyday study — keep sessions short and come back tomorrow.'
