export const LONGTEXT_THRESHOLD = 70

export const TITLE_MAX_LENGTH = 30

export const LEVELS = Array.from({ length: 9 }, (_, index) => index)

export const APP_URL = import.meta.env.DEV
  ? 'https://spaced-rep-app-beta.vercel.app/'
  : window.location.origin
