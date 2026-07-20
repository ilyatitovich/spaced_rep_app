const INSTALL_DISMISSED_KEY = 'installPromptDismissed'
const SOFT_BANNER_DISMISSED_KEY = 'installedSoftBannerDismissed'
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const mql = window.matchMedia?.('(display-mode: standalone)').matches
  const iosStandalone = (navigator as { standalone?: boolean }).standalone
  return Boolean(mql || iosStandalone)
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  )
}

// Only real Safari on iOS exposes the Add to Home Screen PWA path. Chrome
// (CriOS), Firefox (FxiOS), Edge (EdgiOS) etc. are WebKit shells without it.
export function isIosSafari(): boolean {
  if (!isIos()) return false
  const ua = navigator.userAgent
  return !/(crios|fxios|edgios|opios|mercury)/i.test(ua)
}

export function isInstallPromptDismissed(): boolean {
  try {
    const raw = localStorage.getItem(INSTALL_DISMISSED_KEY)
    if (!raw) return false
    const until = Number(raw)
    if (Number.isNaN(until)) return true
    return Date.now() < until
  } catch {
    return false
  }
}

export function dismissInstallPrompt() {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now() + SNOOZE_MS))
  } catch {
    // ignore
  }
}

export function isSoftBannerDismissed(): boolean {
  try {
    return localStorage.getItem(SOFT_BANNER_DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

export function dismissSoftBanner() {
  try {
    localStorage.setItem(SOFT_BANNER_DISMISSED_KEY, 'true')
  } catch {
    // ignore
  }
}

interface RelatedApplication {
  platform?: string
}

export async function hasRelatedAppInstalled(): Promise<boolean> {
  try {
    const nav = navigator as {
      getInstalledRelatedApps?: () => Promise<RelatedApplication[]>
    }
    if (!nav.getInstalledRelatedApps) return false
    const apps = await nav.getInstalledRelatedApps()
    return apps.some(app => app.platform === 'webapp')
  } catch {
    return false
  }
}
