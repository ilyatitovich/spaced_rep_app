export const LONGTEXT_THRESHOLD = 70

export const TITLE_MAX_LENGTH = 30

export const LEVELS = Array.from({ length: 9 }, (_, index) => index)

export const APP_URL = import.meta.env.DEV
  ? 'https://spaced-rep-app-beta.vercel.app/'
  : window.location.origin

// iOS treats `audio/*` as camera/photos; extensions open the Files picker
export const AUDIO_FILE_ACCEPT = '.mp3,.m4a,.wav,.aac,.ogg,.flac,.opus,.caf'
