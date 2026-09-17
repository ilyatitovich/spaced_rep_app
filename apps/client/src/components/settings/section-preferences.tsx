import { useSettingsStore } from '@/store'
import type { ThemePreference } from '@/types/settings.types'
import { SettingsGroup, SettingsSegmentedRow } from './settings-ui'
import { BackButton, Header, Screen } from '@/components'

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
]

type SectionPreferencesProps = {
  isOpen: boolean
}

export default function SectionPreferences({
  isOpen
}: SectionPreferencesProps) {
  const settings = useSettingsStore(s => s.settings)
  const setTheme = useSettingsStore(s => s.setTheme)

  const theme = settings?.preferences.theme ?? 'system'

  return (
    <Screen isOpen={isOpen}>
      <Header>
        <BackButton />
        <span className="font-bold">Preferences</span>
        <span className="w-7" aria-hidden />
      </Header>

      <div className="flex flex-col gap-6 overflow-y-auto h-[92dvh] p-4 pb-30">
        <SettingsGroup label="Appearance">
          <SettingsSegmentedRow
            label="Theme"
            value={theme}
            options={THEME_OPTIONS}
            onChange={v => void setTheme(v as ThemePreference)}
          />
        </SettingsGroup>
      </div>
    </Screen>
  )
}
