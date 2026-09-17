/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
clientsClaim()

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

type PushPayload = {
  title?: string
  body?: string
  url?: string
  icon?: string
}

self.addEventListener('push', event => {
  let payload: PushPayload = {}
  try {
    payload = event.data?.json() as PushPayload
  } catch {
    payload = { body: event.data?.text() }
  }

  const title = payload.title || 'Spaced Repetition'
  const options: NotificationOptions = {
    body: payload.body || '',
    icon: payload.icon || '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    data: { url: payload.url || '/' }
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = (event.notification.data?.url as string | undefined) || '/'

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      })
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            await (client as WindowClient).navigate(targetUrl)
          }
          return
        }
      }
      await self.clients.openWindow(targetUrl)
    })()
  )
})
