import { useSettingsStore } from '@/store'
import type { ThemePreference } from '@/types/settings.types'
import {
  SettingsGroup,
  SettingsSegmentedRow,
  SettingsSelectRow
} from './settings-ui'

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
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

export default function SectionPreferences() {
  const settings = useSettingsStore(s => s.settings)
  const setTheme = useSettingsStore(s => s.setTheme)
  const setTimezone = useSettingsStore(s => s.setTimezone)

  const theme = settings?.preferences.theme ?? 'system'
  const timezone = settings?.preferences.timezone ?? 'UTC'

  const timezoneOptions =
    TIMEZONE_OPTIONS.some(o => o.value === timezone)
      ? TIMEZONE_OPTIONS
      : [{ value: timezone, label: timezone.replace(/_/g, ' ') }, ...TIMEZONE_OPTIONS]

  return (
    <div className="flex flex-col gap-6">
      <SettingsGroup label="Appearance">
        <SettingsSegmentedRow
          label="Theme"
          value={theme}
          options={THEME_OPTIONS}
          onChange={v => void setTheme(v as ThemePreference)}
        />
      </SettingsGroup>

      <SettingsGroup
        label="Region"
        footer="Used for reminders and local scheduling."
      >
        <SettingsSelectRow
          label="Timezone"
          value={timezone}
          options={timezoneOptions}
          onChange={v => void setTimezone(v)}
        />
      </SettingsGroup>
    </div>
  )
}
