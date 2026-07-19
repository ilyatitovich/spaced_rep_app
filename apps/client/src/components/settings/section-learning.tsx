import { useSettingsStore } from '@/store'
import {
  SettingsGroup,
  SettingsSelectRow
} from './settings-ui'

const WEEK_DAY_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' }
]

const DAILY_LIMIT_OPTIONS = [
  { value: '', label: 'Unlimited' },
  { value: '5', label: '5' },
  { value: '10', label: '10' },
  { value: '20', label: '20' },
  { value: '30', label: '30' },
  { value: '50', label: '50' },
  { value: '100', label: '100' }
]

export default function SectionLearning() {
  const settings = useSettingsStore(s => s.settings)
  const setLearning = useSettingsStore(s => s.setLearning)

  const weekStartsOn = settings?.learning.weekStartsOn ?? 0
  const dailyNewCardLimit = settings?.learning.dailyNewCardLimit ?? null

  const limitValue =
    dailyNewCardLimit === null ? '' : String(dailyNewCardLimit)

  const limitOptions =
    dailyNewCardLimit !== null &&
    !DAILY_LIMIT_OPTIONS.some(o => o.value === String(dailyNewCardLimit))
      ? [
          ...DAILY_LIMIT_OPTIONS,
          { value: String(dailyNewCardLimit), label: String(dailyNewCardLimit) }
        ]
      : DAILY_LIMIT_OPTIONS

  return (
    <div className="flex flex-col gap-6">
      <SettingsGroup
        label="Study"
        footer="These preferences sync across your devices when signed in."
      >
        <SettingsSelectRow
          label="Week starts on"
          value={String(weekStartsOn)}
          options={WEEK_DAY_OPTIONS}
          onChange={v => void setLearning({ weekStartsOn: Number(v) })}
        />
        <SettingsSelectRow
          label="New cards per day"
          value={limitValue}
          options={limitOptions}
          onChange={v =>
            void setLearning({
              dailyNewCardLimit: v === '' ? null : Number(v)
            })
          }
        />
      </SettingsGroup>
    </div>
  )
}
