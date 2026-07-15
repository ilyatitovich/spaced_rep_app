export const LONGTEXT_THRESHOLD = 70

export const TITLE_MAX_LENGTH = 30

export const LEVELS = new Array(9).fill(null).map((_, index) => index)

export const APP_URL = import.meta.env.DEV
  ? 'https://spaced-rep-app-beta.vercel.app/'
  : window.location.origin
