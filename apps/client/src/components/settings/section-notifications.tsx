import { Lock, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useSearchParams } from 'react-router'

import { BackButton, Header, Screen, Button } from '@/components'
import { useAuth } from '@/contexts'
import {
  canUseWebPush,
  ensurePushSubscription,
  hasEnabledPushReminder,
  subscribeToPush,
  unsubscribeFromPush
} from '@/services/push.service'
import { useSettingsStore } from '@/store'
import type {
  NotificationChannel,
  NotificationReminder
} from '@/types/settings.types'
import {
  SettingsActionRow,
  SettingsGroup,
  SettingsSegmentedRow,
  SettingsSelectRow,
  SettingsToggleRow
} from './settings-ui'

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'push', label: 'Push' }
]

function getTimezoneOptions(): { value: string; label: string }[] {
  try {
    const zones =
      typeof Intl.supportedValuesOf === 'function'
        ? Intl.supportedValuesOf('timeZone')
        : []
    if (zones.length > 0) {
      return zones.map(z => ({ value: z, label: z.replace(/_/g, ' ') }))
    }
  } catch {
    // fall through
  }
  return [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'America/New York' },
    { value: 'America/Los_Angeles', label: 'America/Los Angeles' },
    { value: 'Europe/London', label: 'Europe/London' },
    { value: 'Europe/Paris', label: 'Europe/Paris' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo' }
  ]
}

const TIMEZONE_OPTIONS = getTimezoneOptions()

function newReminder(sortOrder: number): NotificationReminder {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    timeLocal: '09:00',
    daysOfWeek: 127,
    channel: 'email',
    enabled: true,
    sortOrder,
    updatedAt: now
  }
}

function channelLabel(channel: NotificationChannel): string {
  return channel === 'push' ? 'Push' : 'Email'
}

type SectionNotificationsProps = {
  isOpen: boolean
}

export default function SectionNotifications({
  isOpen
}: SectionNotificationsProps) {
  const { user } = useAuth()
  const [, setSearchParams] = useSearchParams()
  const settings = useSettingsStore(s => s.settings)
  const setNotifications = useSettingsStore(s => s.setNotifications)
  const hasPro = useSettingsStore(s => s.hasPlan('pro'))
  const [draftTime, setDraftTime] = useState('09:00')
  const [draftChannel, setDraftChannel] = useState<NotificationChannel>('email')
  const [pushHint, setPushHint] = useState<string | null>(null)

  const enabled = settings?.notifications.enabled ?? false
  const reminders = settings?.notifications.reminders ?? []
  const timezone = settings?.notifications.timezone ?? 'UTC'

  const timezoneOptions = TIMEZONE_OPTIONS.some(o => o.value === timezone)
    ? TIMEZONE_OPTIONS
    : [
        { value: timezone, label: timezone.replace(/_/g, ' ') },
        ...TIMEZONE_OPTIONS
      ]

  useEffect(() => {
    if (!isOpen || !user || !enabled) return
    const current =
      useSettingsStore.getState().settings?.notifications.reminders ?? []
    void ensurePushSubscription(current)
  }, [isOpen, user, enabled])

  const handleSignIn = () => {
    setSearchParams(prev => {
      prev.set('auth', 'true')
      return new URLSearchParams(prev)
    })
  }

  const requirePro = (): boolean => {
    if (hasPro) return true
    setSearchParams(prev => {
      prev.delete('notifications')
      prev.set('subscription', 'true')
      return new URLSearchParams(prev)
    })
    return false
  }

  const updateReminders = async (next: NotificationReminder[]) => {
    await setNotifications({ reminders: next })
    if (!hasEnabledPushReminder(next)) {
      await unsubscribeFromPush()
      setPushHint(null)
    }
  }

  const handleAdd = async () => {
    const reminder = newReminder(reminders.length)
    reminder.timeLocal = draftTime.length === 5 ? `${draftTime}:00` : draftTime
    reminder.channel = draftChannel

    if (draftChannel === 'push') {
      if (!requirePro()) return
      const result = await subscribeToPush()
      if (!result.ok) {
        setPushHint(result.message)
        toast.error(result.message)
        if (result.reason === 'need-install' || result.reason === 'denied') {
          return
        }
        if (
          result.reason === 'unsupported' ||
          result.reason === 'unauthenticated'
        ) {
          return
        }
        return
      }
      setPushHint(null)
    }

    await updateReminders([...reminders, reminder])
  }

  const handleChannelChange = async (
    id: string,
    channel: NotificationChannel
  ) => {
    if (channel === 'push') {
      if (!requirePro()) return
      const result = await subscribeToPush()
      if (!result.ok) {
        setPushHint(result.message)
        toast.error(result.message)
        return
      }
      setPushHint(null)
    }

    const next = reminders.map(r =>
      r.id === id ? { ...r, channel, updatedAt: Date.now() } : r
    )
    await updateReminders(next)
  }

  const handleToggleReminder = (id: string, checked: boolean) => {
    void updateReminders(
      reminders.map(r =>
        r.id === id ? { ...r, enabled: checked, updatedAt: Date.now() } : r
      )
    )
  }

  const handleDelete = (id: string) => {
    void updateReminders(reminders.filter(r => r.id !== id))
  }

  const formatTime = (timeLocal: string) => timeLocal.slice(0, 5)

  return (
    <Screen isOpen={isOpen}>
      <Header>
        <BackButton />
        <span className="font-bold">Notifications</span>
        <span className="w-7" aria-hidden />
      </Header>

      <div className="flex flex-col gap-6 overflow-y-auto h-[92dvh] p-4 pb-30">
        {!user ? (
          <SettingsGroup footer="Sign in to set study reminders and choose email or push delivery.">
            <SettingsActionRow
              icon={<Lock size={18} />}
              label="Sign in"
              onClick={handleSignIn}
            />
          </SettingsGroup>
        ) : (
          <>
            <SettingsGroup
              label="Alerts"
              footer={
                pushHint ??
                'Email works without installing the app. Push needs permission (and Home Screen install on iOS).'
              }
            >
              <SettingsToggleRow
                label="Enable notifications"
                checked={enabled}
                onChange={checked => {
                  if (checked && !requirePro()) return
                  void setNotifications({ enabled: checked })
                }}
              />
            </SettingsGroup>

            <SettingsGroup
              label="Schedule"
              footer="Reminder times use this timezone."
            >
              <SettingsSelectRow
                label="Timezone"
                value={timezone}
                options={timezoneOptions}
                onChange={v => void setNotifications({ timezone: v })}
              />
            </SettingsGroup>

            <SettingsGroup label="Reminders">
              {reminders.length === 0 ? (
                <p className="px-4 py-3.5 text-sm text-foreground-muted">
                  No reminders yet.
                </p>
              ) : (
                reminders.map(reminder => (
                  <div key={reminder.id} className="flex flex-col">
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium block">
                          {formatTime(reminder.timeLocal)}
                        </span>
                        <span className="text-xs text-foreground-muted">
                          Every day · {channelLabel(reminder.channel)}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={reminder.enabled}
                        disabled={!enabled}
                        onChange={e =>
                          handleToggleReminder(reminder.id, e.target.checked)
                        }
                        className="settings-switch shrink-0"
                      />
                      <Button
                        variant="dangerLink"
                        className="p-1"
                        onClick={() => handleDelete(reminder.id)}
                        aria-label="Remove reminder"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                    <SettingsSegmentedRow
                      label="Delivery"
                      value={reminder.channel}
                      options={CHANNEL_OPTIONS}
                      onChange={v =>
                        void handleChannelChange(
                          reminder.id,
                          v as NotificationChannel
                        )
                      }
                    />
                  </div>
                ))
              )}

              <div className="flex flex-col gap-2 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={draftTime}
                    onChange={e => setDraftTime(e.target.value)}
                    className="flex-1 text-sm bg-transparent border border-border rounded-lg px-3 py-2 outline-none focus:border-input-focus focus:ring-1 focus:ring-focus-ring"
                  />
                  <Button
                    variant="link"
                    className="gap-1 shrink-0"
                    onClick={() => void handleAdd()}
                  >
                    <Plus size={16} />
                    Add
                  </Button>
                </div>
                <SettingsSegmentedRow
                  label="Delivery"
                  value={draftChannel}
                  options={CHANNEL_OPTIONS}
                  onChange={v => setDraftChannel(v as NotificationChannel)}
                />
                {draftChannel === 'push' && !canUseWebPush() && (
                  <p className="text-xs text-foreground-muted">
                    On iPhone/iPad: Share → Add to Home Screen, open the icon,
                    then choose Push.
                  </p>
                )}
              </div>
            </SettingsGroup>

            {!enabled && reminders.length > 0 && (
              <SettingsGroup>
                <SettingsActionRow
                  label="Turn on notifications to use reminders"
                  onClick={() => {
                    if (!requirePro()) return
                    void setNotifications({ enabled: true })
                  }}
                />
              </SettingsGroup>
            )}
          </>
        )}
      </div>
    </Screen>
  )
}
