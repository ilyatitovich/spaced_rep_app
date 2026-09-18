import { describe, expect, it } from 'vitest'

import { describeSyncDevice } from '../get-device-platform'

const UAS = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  ipod:
    'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  ipad:
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  androidPhone:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 12; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  samsung:
    'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/110.0.5481.154 Mobile Safari/537.36',
  pixel:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  xiaomi:
    'Mozilla/5.0 (Linux; Android 13; 2211133G Build/TKQ1.220905.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.43 Mobile Safari/537.36 Xiaomi',
  xiaomiModelOnly:
    'Mozilla/5.0 (Linux; Android 13; 2211133G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  windowsFirefox:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  mac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  linux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
} as const

describe('describeSyncDevice', () => {
  it('prefers a custom name over the parsed label', () => {
    expect(describeSyncDevice(UAS.iphone, 'Work phone')).toEqual({
      formFactor: 'phone',
      label: 'Work phone'
    })
  })

  it('ignores blank names', () => {
    expect(describeSyncDevice(UAS.linux, '   ')).toEqual({
      formFactor: 'desktop',
      label: 'Chrome on Linux'
    })
  })

  it('labels Apple phones and tablets with browser', () => {
    expect(describeSyncDevice(UAS.iphone)).toEqual({
      formFactor: 'phone',
      label: 'Safari on iPhone'
    })
    expect(describeSyncDevice(UAS.ipod)).toEqual({
      formFactor: 'phone',
      label: 'Safari on iPhone'
    })
    expect(describeSyncDevice(UAS.ipad)).toEqual({
      formFactor: 'tablet',
      label: 'Safari on iPad'
    })
  })

  it('treats Android Mobile as phone and Android without Mobile as tablet', () => {
    expect(describeSyncDevice(UAS.androidPhone)).toEqual({
      formFactor: 'phone',
      label: 'Chrome on Android'
    })
    expect(describeSyncDevice(UAS.androidTablet)).toEqual({
      formFactor: 'tablet',
      label: 'Chrome on Android'
    })
  })

  it('keeps Samsung, Pixel, and Xiaomi only when those strings appear in the UA', () => {
    expect(describeSyncDevice(UAS.samsung)).toEqual({
      formFactor: 'phone',
      label: 'Samsung Internet on Samsung'
    })
    expect(describeSyncDevice(UAS.pixel)).toEqual({
      formFactor: 'phone',
      label: 'Chrome on Pixel'
    })
    expect(describeSyncDevice(UAS.xiaomi)).toEqual({
      formFactor: 'phone',
      label: 'Chrome on Xiaomi'
    })
    expect(describeSyncDevice(UAS.xiaomiModelOnly)).toEqual({
      formFactor: 'phone',
      label: 'Chrome on Android'
    })
  })

  it('labels desktop as browser on OS so browsers are distinguishable', () => {
    expect(describeSyncDevice(UAS.windows)).toEqual({
      formFactor: 'desktop',
      label: 'Chrome on Windows'
    })
    expect(describeSyncDevice(UAS.windowsFirefox)).toEqual({
      formFactor: 'desktop',
      label: 'Firefox on Windows'
    })
    expect(describeSyncDevice(UAS.mac)).toEqual({
      formFactor: 'desktop',
      label: 'Chrome on Mac'
    })
    expect(describeSyncDevice(UAS.macSafari)).toEqual({
      formFactor: 'desktop',
      label: 'Safari on Mac'
    })
    expect(describeSyncDevice(UAS.linux)).toEqual({
      formFactor: 'desktop',
      label: 'Chrome on Linux'
    })
  })

  it('falls back for missing or unrecognized UAs', () => {
    expect(describeSyncDevice(null)).toEqual({
      formFactor: 'desktop',
      label: 'Unknown device'
    })
    expect(describeSyncDevice('')).toEqual({
      formFactor: 'desktop',
      label: 'Unknown device'
    })
    expect(describeSyncDevice('SomeBot/1.0')).toEqual({
      formFactor: 'desktop',
      label: 'Unknown device'
    })
  })
})
