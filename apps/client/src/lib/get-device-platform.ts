type DevicePlatform =
  'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'Other'

export type SyncDeviceFormFactor = 'phone' | 'tablet' | 'desktop'

export interface SyncDeviceDescription {
  formFactor: SyncDeviceFormFactor
  label: string
}

export function getDevicePlatform(): DevicePlatform {
  if (typeof navigator === 'undefined') return 'Other'

  const ua = navigator.userAgent.toLowerCase()
  const platform = navigator.platform?.toLowerCase() || ''

  // Mobile detection first (more reliable signals)
  if (
    /iphone|ipad|ipod/.test(ua) ||
    (/macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  ) {
    return 'iOS'
  }

  if (/android/.test(ua)) {
    return 'Android'
  }

  // Desktop / laptop OS
  if (/win/.test(platform) || /win/.test(ua)) {
    return 'Windows'
  }

  if (/mac/.test(platform) || /mac/.test(ua)) {
    return 'macOS'
  }

  if (/linux/.test(platform) || /linux/.test(ua)) {
    return 'Linux'
  }

  return 'Other'
}

export function isMobileDevice(): boolean {
  const platform = getDevicePlatform()
  if (['iOS', 'Android'].includes(platform)) return true
  return false
}

/** Friendly label + form factor from a stored sync-device UA. No iPad-as-Mac hack — stored UAs lack maxTouchPoints. */
export function describeSyncDevice(
  ua: string | null | undefined,
  name?: string | null
): SyncDeviceDescription {
  const trimmedName = name?.trim()
  const parsed = parseSyncDeviceUa(ua)
  return {
    formFactor: parsed.formFactor,
    label: trimmedName || parsed.label
  }
}

function parseSyncDeviceUa(
  ua: string | null | undefined
): SyncDeviceDescription {
  if (!ua?.trim()) {
    return { formFactor: 'desktop', label: 'Unknown device' }
  }

  const lower = ua.toLowerCase()

  if (/iphone|ipod/.test(lower)) {
    return { formFactor: 'phone', label: 'iPhone' }
  }

  if (/ipad/.test(lower)) {
    return { formFactor: 'tablet', label: 'iPad' }
  }

  if (/android/.test(lower)) {
    const brand = androidBrand(lower)
    const isPhone = /mobile/.test(lower)
    return {
      formFactor: isPhone ? 'phone' : 'tablet',
      label: brand ?? 'Android'
    }
  }

  if (/windows/.test(lower)) {
    return { formFactor: 'desktop', label: 'Windows' }
  }

  if (/macintosh|mac os x/.test(lower)) {
    return { formFactor: 'desktop', label: 'Mac' }
  }

  if (/linux/.test(lower)) {
    return { formFactor: 'desktop', label: 'Linux' }
  }

  return { formFactor: 'desktop', label: 'Unknown device' }
}

function androidBrand(lowerUa: string): string | null {
  if (lowerUa.includes('samsung')) return 'Samsung'
  if (lowerUa.includes('pixel')) return 'Pixel'
  if (lowerUa.includes('xiaomi')) return 'Xiaomi'
  return null
}
