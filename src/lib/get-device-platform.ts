
type DevicePlatform = 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'Other'

export function getDevicePlatform(): DevicePlatform {
  if (typeof navigator === 'undefined') return 'Other';

  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';

  // Mobile detection first (more reliable signals)
  if (/iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    return 'iOS';
  }

  if (/android/.test(ua)) {
    return 'Android';
  }

  // Desktop / laptop OS
  if (/win/.test(platform) || /win/.test(ua)) {
    return 'Windows';
  }

  if (/mac/.test(platform) || /mac/.test(ua)) {
    return 'macOS';
  }

  if (/linux/.test(platform) || /linux/.test(ua)) {
    return 'Linux';
  }

  return 'Other';
}


export function isMobileDevice(): boolean {
  const platform = getDevicePlatform()
  if (['iOS', 'Android'].includes(platform)) return true
  return false
}
