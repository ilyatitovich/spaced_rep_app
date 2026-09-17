import { isBackendConfigured, settings as settingsBackend } from '@/providers'
import { getAuthSession } from '@/lib/auth-storage'
import { isIos, isStandaloneDisplay } from '@/lib/pwa'
import { getDeviceId } from '@/services/sync.service'
import type { NotificationReminder } from '@/types/settings.types'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function isPushApiAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** iOS only exposes push inside an installed Home Screen PWA. */
export function canUseWebPush(): boolean {
  if (!isPushApiAvailable()) return false
  if (isIos() && !isStandaloneDisplay()) return false
  return true
}

export type PushSubscribeResult =
  | { ok: true }
  | {
      ok: false
      reason: 'unsupported' | 'need-install' | 'denied' | 'unauthenticated' | 'error'
      message: string
    }

export async function subscribeToPush(): Promise<PushSubscribeResult> {
  if (!isBackendConfigured() || !settingsBackend) {
    return {
      ok: false,
      reason: 'unauthenticated',
      message: 'Sign in to enable push notifications.'
    }
  }
  if (!getAuthSession()) {
    return {
      ok: false,
      reason: 'unauthenticated',
      message: 'Sign in to enable push notifications.'
    }
  }
  if (isIos() && !isStandaloneDisplay()) {
    return {
      ok: false,
      reason: 'need-install',
      message:
        'Add this app to your Home Screen, open it from the icon, then enable push.'
    }
  }
  if (!canUseWebPush()) {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'Push notifications are not supported in this browser.'
    }
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return {
        ok: false,
        reason: 'denied',
        message: 'Notification permission was denied.'
      }
    }

    const registration = await navigator.serviceWorker.ready
    const { publicKey } = await settingsBackend.fetchVapidPublicKey()
    const existing = await registration.pushManager.getSubscription()
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          publicKey
        ) as BufferSource
      }))

    const json = subscription.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return {
        ok: false,
        reason: 'error',
        message: 'Invalid push subscription from browser.'
      }
    }

    const deviceId = await getDeviceId()
    await settingsBackend.putPushSubscription({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      deviceId
    })
    return { ok: true }
  } catch (error) {
    console.error('Push subscribe failed:', error)
    return {
      ok: false,
      reason: 'error',
      message:
        error instanceof Error ? error.message : 'Failed to enable push.'
    }
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushApiAvailable()) return
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) return
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return
    const endpoint = subscription.endpoint
    await subscription.unsubscribe()
    if (settingsBackend && getAuthSession()) {
      await settingsBackend.deletePushSubscription({ endpoint })
    }
  } catch (error) {
    console.error('Push unsubscribe failed:', error)
  }
}

export function hasEnabledPushReminder(
  reminders: NotificationReminder[]
): boolean {
  return reminders.some(r => r.enabled && r.channel === 'push')
}

/** Re-register subscription if any push reminder is active. */
export async function ensurePushSubscription(
  reminders: NotificationReminder[]
): Promise<void> {
  if (!hasEnabledPushReminder(reminders)) return
  if (!canUseWebPush()) return
  if (!getAuthSession() || !settingsBackend) return
  if (Notification.permission !== 'granted') return

  try {
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      const result = await subscribeToPush()
      if (!result.ok) return
      return
    }
    const json = subscription.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return
    const deviceId = await getDeviceId()
    await settingsBackend.putPushSubscription({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      deviceId
    })
  } catch (error) {
    console.error('ensurePushSubscription failed:', error)
  }
}
