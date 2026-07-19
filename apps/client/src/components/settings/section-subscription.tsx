import { useEffect } from 'react'

import { useAuth } from '@/contexts'
import { useSettingsStore } from '@/store'
import type { PlanTier, SubscriptionStatus } from '@/types/settings.types'
import {
  SettingsActionRow,
  SettingsGroup,
  SettingsInfoRow
} from './settings-ui'

const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  pro: 'Pro',
  pro_plus: 'Pro+'
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Past due',
  canceled: 'Canceled',
  expired: 'Expired',
  incomplete: 'Incomplete'
}

function formatDate(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export default function SectionSubscription() {
  const { user } = useAuth()
  const settings = useSettingsStore(s => s.settings)
  const refreshSubscription = useSettingsStore(s => s.refreshSubscription)

  useEffect(() => {
    if (user) void refreshSubscription()
  }, [user, refreshSubscription])

  const sub = settings?.subscription

  if (!user) {
    return (
      <SettingsGroup footer="Sign in to view and manage your plan.">
        <SettingsInfoRow label="Plan" value="Free" />
      </SettingsGroup>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsGroup label="Current plan">
        <SettingsInfoRow
          label="Plan"
          value={sub ? PLAN_LABELS[sub.plan] : 'Free'}
        />
        <SettingsInfoRow
          label="Status"
          value={sub ? STATUS_LABELS[sub.status] : 'Active'}
        />
        {sub?.trialEndsAt != null && (
          <SettingsInfoRow
            label="Trial ends"
            value={formatDate(sub.trialEndsAt)}
          />
        )}
        {sub?.currentPeriodEnd != null && (
          <SettingsInfoRow
            label="Renews"
            value={formatDate(sub.currentPeriodEnd)}
          />
        )}
        {sub?.cancelAtPeriodEnd && (
          <SettingsInfoRow label="Cancels" value="At period end" />
        )}
      </SettingsGroup>

      <SettingsGroup footer="Billing management is coming soon.">
        <SettingsActionRow label="Upgrade" onClick={() => {}} disabled />
        <SettingsActionRow
          label="Manage billing"
          onClick={() => {}}
          disabled
        />
      </SettingsGroup>
    </div>
  )
}
