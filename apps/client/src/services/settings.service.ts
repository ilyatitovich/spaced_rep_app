import {
  isBackendConfigured,
  settings as settingsBackend
} from '@/providers'
import { getAuthSession } from '@/lib/auth-storage'
import { STORES, withTransaction } from '@/lib/db'
import {
  applyThemeToDocument,
  defaultLearning,
  defaultNotifications,
  defaultPreferences,
  defaultSubscription,
  SETTINGS_LOCAL_KEY,
  shouldApplySettingsLww
} from '@/lib/settings'
import type {
  NotificationReminder,
  SettingsOutboxItem,
  SettingsSection,
  SubscriptionSnapshot,
  UserLearningSettings,
  UserNotificationSettings,
  UserPreferences,
  UserSettingsDocument
} from '@/types/settings.types'
import { getDeviceId } from './sync.service'

type PrefRow = UserPreferences & { id: string }
type LearningRow = UserLearningSettings & { id: string }
type NotifRow = Omit<UserNotificationSettings, 'reminders'> & { id: string }
type ReminderRow = NotificationReminder & { ownerKey: string }
type SubRow = SubscriptionSnapshot & { id: string; fetchedAt: number }

const TRIGGER_DEBOUNCE_MS = 1500
const MAX_ATTEMPTS = 10

let currentOwnerKey = SETTINGS_LOCAL_KEY
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushInFlight = false

const listeners = new Set<(doc: UserSettingsDocument) => void>()
let memoryDoc: UserSettingsDocument | null = null

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function emit(doc: UserSettingsDocument): void {
  memoryDoc = doc
  listeners.forEach(l => l(doc))
}

export function subscribeSettings(
  listener: (doc: UserSettingsDocument) => void
): () => void {
  listeners.add(listener)
  if (memoryDoc) listener(memoryDoc)
  return () => listeners.delete(listener)
}

export function getSettingsMemory(): UserSettingsDocument | null {
  return memoryDoc
}

async function readDoc(ownerKey: string): Promise<UserSettingsDocument> {
  const [pref, learning, notif, reminders, sub] = await Promise.all([
    withTransaction(STORES.USER_PREFERENCES, 'readonly', stores =>
      promisify<PrefRow | undefined>(
        stores[STORES.USER_PREFERENCES].get(ownerKey)
      )
    ),
    withTransaction(STORES.USER_LEARNING_SETTINGS, 'readonly', stores =>
      promisify<LearningRow | undefined>(
        stores[STORES.USER_LEARNING_SETTINGS].get(ownerKey)
      )
    ),
    withTransaction(STORES.USER_NOTIFICATION_SETTINGS, 'readonly', stores =>
      promisify<NotifRow | undefined>(
        stores[STORES.USER_NOTIFICATION_SETTINGS].get(ownerKey)
      )
    ),
    withTransaction(STORES.NOTIFICATION_REMINDERS, 'readonly', async stores => {
      const index = stores[STORES.NOTIFICATION_REMINDERS].index('ownerKey')
      return promisify<ReminderRow[]>(index.getAll(ownerKey))
    }),
    withTransaction(STORES.SUBSCRIPTION_CACHE, 'readonly', stores =>
      promisify<SubRow | undefined>(
        stores[STORES.SUBSCRIPTION_CACHE].get(ownerKey)
      )
    )
  ])

  const preferences = pref
    ? {
        theme: pref.theme,
        language: pref.language,
        timezone: pref.timezone,
        updatedAt: pref.updatedAt,
        updatedByDeviceId: pref.updatedByDeviceId
      }
    : defaultPreferences()

  const learningSettings = learning
    ? {
        weekStartsOn: learning.weekStartsOn,
        dailyNewCardLimit: learning.dailyNewCardLimit,
        updatedAt: learning.updatedAt,
        updatedByDeviceId: learning.updatedByDeviceId
      }
    : defaultLearning()

  const notifications: UserNotificationSettings = notif
    ? {
        enabled: notif.enabled,
        timezone: notif.timezone,
        updatedAt: notif.updatedAt,
        updatedByDeviceId: notif.updatedByDeviceId,
        reminders: reminders
          .map(({ id, timeLocal, daysOfWeek, channel, enabled, sortOrder, updatedAt }) => ({
            id,
            timeLocal,
            daysOfWeek,
            channel,
            enabled,
            sortOrder,
            updatedAt
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
      }
    : defaultNotifications()

  const subscription = sub
    ? {
        plan: sub.plan,
        status: sub.status,
        provider: sub.provider,
        currentPeriodEnd: sub.currentPeriodEnd,
        trialEndsAt: sub.trialEndsAt,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        serverUpdatedAt: sub.serverUpdatedAt
      }
    : defaultSubscription()

  return { preferences, learning: learningSettings, notifications, subscription }
}

async function writePreferences(
  ownerKey: string,
  preferences: UserPreferences
): Promise<void> {
  await withTransaction(STORES.USER_PREFERENCES, 'readwrite', async stores => {
    await promisify(
      stores[STORES.USER_PREFERENCES].put({ id: ownerKey, ...preferences })
    )
  })
}

async function writeLearning(
  ownerKey: string,
  learning: UserLearningSettings
): Promise<void> {
  await withTransaction(
    STORES.USER_LEARNING_SETTINGS,
    'readwrite',
    async stores => {
      await promisify(
        stores[STORES.USER_LEARNING_SETTINGS].put({ id: ownerKey, ...learning })
      )
    }
  )
}

async function writeNotifications(
  ownerKey: string,
  notifications: UserNotificationSettings
): Promise<void> {
  await withTransaction(
    [
      STORES.USER_NOTIFICATION_SETTINGS,
      STORES.NOTIFICATION_REMINDERS
    ],
    'readwrite',
    async stores => {
      const { reminders, ...master } = notifications
      await promisify(
        stores[STORES.USER_NOTIFICATION_SETTINGS].put({
          id: ownerKey,
          ...master
        })
      )

      const index = stores[STORES.NOTIFICATION_REMINDERS].index('ownerKey')
      const existing = await promisify<ReminderRow[]>(index.getAll(ownerKey))
      const nextIds = new Set(reminders.map(r => r.id))
      for (const row of existing) {
        if (!nextIds.has(row.id)) {
          await promisify(stores[STORES.NOTIFICATION_REMINDERS].delete(row.id))
        }
      }
      for (const rem of reminders) {
        await promisify(
          stores[STORES.NOTIFICATION_REMINDERS].put({
            ...rem,
            ownerKey
          })
        )
      }
    }
  )
}

async function writeSubscription(
  ownerKey: string,
  subscription: SubscriptionSnapshot
): Promise<void> {
  await withTransaction(STORES.SUBSCRIPTION_CACHE, 'readwrite', async stores => {
    await promisify(
      stores[STORES.SUBSCRIPTION_CACHE].put({
        id: ownerKey,
        ...subscription,
        fetchedAt: Date.now()
      })
    )
  })
}

async function enqueueOutbox(
  section: SettingsSection,
  payload: Record<string, unknown>
): Promise<void> {
  if (currentOwnerKey === SETTINGS_LOCAL_KEY) return

  const item: SettingsOutboxItem = {
    id: section,
    section,
    payload,
    opId: crypto.randomUUID(),
    updatedAt: Date.now(),
    attempts: 0,
    nextRetryAt: 0
  }
  await withTransaction(STORES.SETTINGS_OUTBOX, 'readwrite', async stores => {
    await promisify(stores[STORES.SETTINGS_OUTBOX].put(item))
  })
  triggerSettingsFlush()
}

export function triggerSettingsFlush(): void {
  if (currentOwnerKey === SETTINGS_LOCAL_KEY) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  if (!isBackendConfigured()) return

  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushSettingsOutbox()
  }, TRIGGER_DEBOUNCE_MS)
}

async function getOutbox(): Promise<SettingsOutboxItem[]> {
  return withTransaction(STORES.SETTINGS_OUTBOX, 'readonly', stores =>
    promisify<SettingsOutboxItem[]>(stores[STORES.SETTINGS_OUTBOX].getAll())
  )
}

async function removeOutbox(id: string): Promise<void> {
  await withTransaction(STORES.SETTINGS_OUTBOX, 'readwrite', async stores => {
    await promisify(stores[STORES.SETTINGS_OUTBOX].delete(id))
  })
}

async function bumpOutbox(item: SettingsOutboxItem): Promise<void> {
  const attempts = item.attempts + 1
  const next: SettingsOutboxItem = {
    ...item,
    attempts,
    nextRetryAt: Date.now() + Math.min(60_000, 1000 * 2 ** attempts)
  }
  await withTransaction(STORES.SETTINGS_OUTBOX, 'readwrite', async stores => {
    await promisify(stores[STORES.SETTINGS_OUTBOX].put(next))
  })
}

export async function flushSettingsOutbox(): Promise<void> {
  if (flushInFlight || currentOwnerKey === SETTINGS_LOCAL_KEY) return
  if (!settingsBackend) return
  const session = getAuthSession()
  if (!session) return

  flushInFlight = true
  try {
    const now = Date.now()
    const items = (await getOutbox()).filter(
      i => i.attempts < MAX_ATTEMPTS && i.nextRetryAt <= now
    )

    for (const item of items) {
      try {
        if (item.section === 'preferences') {
          const canonical = await settingsBackend.patchPreferences(
            item.payload as Parameters<
              typeof settingsBackend.patchPreferences
            >[0]
          )
          await writePreferences(currentOwnerKey, canonical)
        } else if (item.section === 'learning') {
          const canonical = await settingsBackend.patchLearning(
            item.payload as Parameters<typeof settingsBackend.patchLearning>[0]
          )
          await writeLearning(currentOwnerKey, canonical)
        } else if (item.section === 'notifications') {
          const canonical = await settingsBackend.patchNotifications(
            item.payload as Parameters<
              typeof settingsBackend.patchNotifications
            >[0]
          )
          await writeNotifications(currentOwnerKey, canonical)
        }
        await removeOutbox(item.id)
      } catch {
        await bumpOutbox(item)
      }
    }

    const doc = await readDoc(currentOwnerKey)
    applyThemeToDocument(doc.preferences.theme)
    emit(doc)
  } finally {
    flushInFlight = false
  }
}

/** Seed local defaults if missing; hydrate memory + theme. */
export async function bootstrapLocalSettings(): Promise<UserSettingsDocument> {
  const ownerKey = currentOwnerKey
  const existing = await withTransaction(
    STORES.USER_PREFERENCES,
    'readonly',
    stores =>
      promisify<PrefRow | undefined>(
        stores[STORES.USER_PREFERENCES].get(ownerKey)
      )
  )

  if (!existing) {
    const now = Date.now()
    await writePreferences(ownerKey, defaultPreferences(now))
    await writeLearning(ownerKey, defaultLearning(now))
    await writeNotifications(ownerKey, defaultNotifications(now))
    await writeSubscription(ownerKey, defaultSubscription(now))
  }

  const doc = await readDoc(ownerKey)
  applyThemeToDocument(doc.preferences.theme)
  emit(doc)
  return doc
}

function mergePreferences(
  local: UserPreferences,
  remote: UserPreferences,
  deviceId: string
): UserPreferences {
  return shouldApplySettingsLww(
    local.updatedAt,
    local.updatedByDeviceId,
    remote.updatedAt,
    remote.updatedByDeviceId ?? deviceId
  )
    ? remote
    : local
}

function mergeLearning(
  local: UserLearningSettings,
  remote: UserLearningSettings,
  deviceId: string
): UserLearningSettings {
  return shouldApplySettingsLww(
    local.updatedAt,
    local.updatedByDeviceId,
    remote.updatedAt,
    remote.updatedByDeviceId ?? deviceId
  )
    ? remote
    : local
}

function mergeNotifications(
  local: UserNotificationSettings,
  remote: UserNotificationSettings,
  deviceId: string
): UserNotificationSettings {
  const master = shouldApplySettingsLww(
    local.updatedAt,
    local.updatedByDeviceId,
    remote.updatedAt,
    remote.updatedByDeviceId ?? deviceId
  )
    ? remote
    : local

  const byId = new Map<string, NotificationReminder>()
  for (const rem of local.reminders) byId.set(rem.id, rem)
  for (const rem of remote.reminders) {
    const prev = byId.get(rem.id)
    if (
      shouldApplySettingsLww(
        prev?.updatedAt,
        undefined,
        rem.updatedAt,
        deviceId
      )
    ) {
      byId.set(rem.id, rem)
    }
  }

  return {
    enabled: master.enabled,
    timezone: master.timezone,
    updatedAt: master.updatedAt,
    updatedByDeviceId: master.updatedByDeviceId,
    reminders: [...byId.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)
    )
  }
}

/** Pull server settings and LWW-merge into IDB for the signed-in user. */
export async function pullAndMergeSettings(userId: string): Promise<void> {
  const session = getAuthSession()
  if (!session || !settingsBackend) return

  const deviceId = await getDeviceId()
  const remote = await settingsBackend.fetchSettings()

  // Migrate 'local' → userId on first login if needed
  const localDoc = await readDoc(SETTINGS_LOCAL_KEY)
  const userDoc = await readDoc(userId)

  const hasUserPrefs = await withTransaction(
    STORES.USER_PREFERENCES,
    'readonly',
    stores =>
      promisify<PrefRow | undefined>(
        stores[STORES.USER_PREFERENCES].get(userId)
      )
  )

  const baseLocal = hasUserPrefs ? userDoc : localDoc

  const preferences = mergePreferences(
    baseLocal.preferences,
    remote.preferences,
    deviceId
  )
  const learning = mergeLearning(baseLocal.learning, remote.learning, deviceId)
  const notifications = mergeNotifications(
    baseLocal.notifications,
    remote.notifications,
    deviceId
  )

  currentOwnerKey = userId
  await writePreferences(userId, preferences)
  await writeLearning(userId, learning)
  await writeNotifications(userId, notifications)
  await writeSubscription(userId, remote.subscription)

  // If local won on prefs and is newer than remote epoch defaults, enqueue push
  if (
    preferences.updatedAt > remote.preferences.updatedAt ||
    (preferences.updatedAt === remote.preferences.updatedAt &&
      (preferences.updatedByDeviceId ?? '') >
        (remote.preferences.updatedByDeviceId ?? ''))
  ) {
    await enqueueOutbox('preferences', {
      theme: preferences.theme,
      language: preferences.language,
      timezone: preferences.timezone,
      updatedAt: preferences.updatedAt,
      deviceId
    })
  }

  const doc = await readDoc(userId)
  applyThemeToDocument(doc.preferences.theme)
  emit(doc)
  void flushSettingsOutbox()
}

export async function refreshSubscriptionCache(): Promise<SubscriptionSnapshot | null> {
  if (!settingsBackend || currentOwnerKey === SETTINGS_LOCAL_KEY) return null
  const session = getAuthSession()
  if (!session) return null
  const sub = await settingsBackend.fetchSubscription()
  await writeSubscription(currentOwnerKey, sub)
  const doc = await readDoc(currentOwnerKey)
  emit(doc)
  return sub
}

export function setSettingsUser(userId: string | null): void {
  currentOwnerKey = userId ?? SETTINGS_LOCAL_KEY
}

export async function updatePreferences(
  patch: Partial<
    Pick<UserPreferences, 'theme' | 'language' | 'timezone'>
  >
): Promise<UserSettingsDocument> {
  const deviceId = await getDeviceId()
  const doc = await readDoc(currentOwnerKey)
  const next: UserPreferences = {
    ...doc.preferences,
    ...patch,
    updatedAt: Date.now(),
    updatedByDeviceId: deviceId
  }
  await writePreferences(currentOwnerKey, next)
  applyThemeToDocument(next.theme)

  if (currentOwnerKey !== SETTINGS_LOCAL_KEY) {
    await enqueueOutbox('preferences', {
      ...patch,
      updatedAt: next.updatedAt,
      deviceId
    })
  }

  const full = { ...doc, preferences: next }
  emit(full)
  return full
}

export async function updateLearning(
  patch: Partial<
    Pick<UserLearningSettings, 'weekStartsOn' | 'dailyNewCardLimit'>
  >
): Promise<UserSettingsDocument> {
  const deviceId = await getDeviceId()
  const doc = await readDoc(currentOwnerKey)
  const next: UserLearningSettings = {
    ...doc.learning,
    ...patch,
    updatedAt: Date.now(),
    updatedByDeviceId: deviceId
  }
  await writeLearning(currentOwnerKey, next)

  if (currentOwnerKey !== SETTINGS_LOCAL_KEY) {
    await enqueueOutbox('learning', {
      ...patch,
      updatedAt: next.updatedAt,
      deviceId
    })
  }

  const full = { ...doc, learning: next }
  emit(full)
  return full
}

export async function updateNotifications(
  patch: Partial<
    Pick<UserNotificationSettings, 'enabled' | 'timezone' | 'reminders'>
  >
): Promise<UserSettingsDocument> {
  const deviceId = await getDeviceId()
  const doc = await readDoc(currentOwnerKey)
  const next: UserNotificationSettings = {
    ...doc.notifications,
    ...patch,
    updatedAt: Date.now(),
    updatedByDeviceId: deviceId
  }
  await writeNotifications(currentOwnerKey, next)

  // Notifications only sync when authenticated
  if (currentOwnerKey !== SETTINGS_LOCAL_KEY) {
    await enqueueOutbox('notifications', {
      enabled: next.enabled,
      timezone: next.timezone,
      reminders: next.reminders,
      updatedAt: next.updatedAt,
      deviceId
    })
  }

  const full = { ...doc, notifications: next }
  emit(full)
  return full
}
