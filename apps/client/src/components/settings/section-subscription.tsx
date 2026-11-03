import { useEffect } from 'react'

import { BackButton, Header, Screen } from '@/components'
import { useAuth } from '@/contexts'
import { PRO_DEVICE_LIMIT } from '@/lib/billing-product'
import { isPlanEntitled } from '@/lib/settings'
import { useSettingsStore } from '@/store'
import type { PlanTier, SubscriptionStatus } from '@/types/settings.types'
import { SettingsGroup, SettingsInfoRow } from './settings-ui'

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
  incomplete: 'Incomplete',
  paused: 'Paused',
  unpaid: 'Unpaid'
}

function formatDate(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

interface SectionSubscriptionProps {
  isOpen: boolean
}

export default function SectionSubscription({
  isOpen
}: SectionSubscriptionProps) {
  const { user } = useAuth()
  const settings = useSettingsStore(s => s.settings)
  const refreshSubscription = useSettingsStore(s => s.refreshSubscription)

  useEffect(() => {
    if (isOpen && user) void refreshSubscription()
  }, [isOpen, user, refreshSubscription])

  const sub = settings?.subscription
  const isEntitled = sub ? isPlanEntitled(sub, 'pro') : false

  return (
    <Screen isOpen={isOpen}>
      <Header>
        <BackButton />
        <span className="font-bold">Subscription</span>
        <span className="w-7" aria-hidden />
      </Header>

      <div className="flex flex-col gap-6 overflow-y-auto h-[92dvh] p-4 pb-30">
        {!user ? (
          <SettingsGroup footer="Sign in when you want cloud sync or study reminders. The local app stays free. Paid checkout is not open yet.">
            <SettingsInfoRow label="Plan" value="Free" />
          </SettingsGroup>
        ) : (
          <SettingsGroup
            label="Current plan"
            footer={
              isEntitled
                ? `Cloud sync, study notifications, and up to ${PRO_DEVICE_LIMIT} devices. Paid checkout and billing management are not open yet.`
                : 'Free includes the full local study app. Sync and notifications unlock with Pro. Paid checkout is not open during this unpaid beta.'
            }
          >
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
            {sub?.endsAt != null && (
              <SettingsInfoRow
                label="Access until"
                value={formatDate(sub.endsAt)}
              />
            )}
            {sub?.currentPeriodEnd != null && sub.endsAt == null && (
              <SettingsInfoRow
                label="Renews"
                value={formatDate(sub.currentPeriodEnd)}
              />
            )}
            {sub?.cancelAtPeriodEnd && (
              <SettingsInfoRow label="Cancels" value="At period end" />
            )}
          </SettingsGroup>
        )}
      </div>
    </Screen>
  )
}
