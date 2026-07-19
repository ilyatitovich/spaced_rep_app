import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { BackButton, Header, Screen } from '@/components'
import { useSettingsStore } from '@/store'
import type { NotificationReminder } from '@/types/settings.types'
import {
  SettingsActionRow,
  SettingsGroup,
  SettingsToggleRow
} from './settings-ui'

function newReminder(sortOrder: number): NotificationReminder {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    timeLocal: '09:00',
    daysOfWeek: 127,
    channel: 'push',
    enabled: true,
    sortOrder,
    updatedAt: now
  }
}

type SectionNotificationsProps = {
  isOpen: boolean
}

export default function SectionNotifications({
  isOpen
}: SectionNotificationsProps) {
  const settings = useSettingsStore(s => s.settings)
  const setNotifications = useSettingsStore(s => s.setNotifications)
  const [draftTime, setDraftTime] = useState('09:00')

  const enabled = settings?.notifications.enabled ?? false
  const reminders = settings?.notifications.reminders ?? []

  const updateReminders = (next: NotificationReminder[]) => {
    void setNotifications({ reminders: next })
  }

  const handleAdd = () => {
    const reminder = newReminder(reminders.length)
    reminder.timeLocal = draftTime.length === 5 ? `${draftTime}:00` : draftTime
    updateReminders([...reminders, reminder])
  }

  const handleToggleReminder = (id: string, checked: boolean) => {
    updateReminders(
      reminders.map(r =>
        r.id === id ? { ...r, enabled: checked, updatedAt: Date.now() } : r
      )
    )
  }

  const handleDelete = (id: string) => {
    updateReminders(reminders.filter(r => r.id !== id))
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
        <SettingsGroup
          label="Alerts"
          footer="Reminders are saved and will notify you when push delivery is available."
        >
          <SettingsToggleRow
            label="Enable notifications"
            checked={enabled}
            onChange={checked => void setNotifications({ enabled: checked })}
          />
        </SettingsGroup>

        <SettingsGroup label="Reminders">
          {reminders.length === 0 ? (
            <p className="px-4 py-3.5 text-sm text-foreground-muted">
              No reminders yet.
            </p>
          ) : (
            reminders.map(reminder => (
              <div
                key={reminder.id}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium block">
                    {formatTime(reminder.timeLocal)}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    Every day · Push
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
                <button
                  type="button"
                  onClick={() => handleDelete(reminder.id)}
                  className="text-danger p-1"
                  aria-label="Remove reminder"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}

          <div className="flex items-center gap-3 px-4 py-3.5">
            <input
              type="time"
              value={draftTime}
              onChange={e => setDraftTime(e.target.value)}
              className="flex-1 text-sm bg-transparent border border-border rounded-lg px-3 py-2 outline-none focus:border-input-focus focus:ring-1 focus:ring-focus-ring"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="flex items-center gap-1 text-primary font-medium shrink-0"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </SettingsGroup>

        {!enabled && reminders.length > 0 && (
          <SettingsGroup>
            <SettingsActionRow
              label="Turn on notifications to use reminders"
              onClick={() => void setNotifications({ enabled: true })}
            />
          </SettingsGroup>
        )}
      </div>
    </Screen>
  )
}
