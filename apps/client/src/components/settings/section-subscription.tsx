import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import { BackButton, Header, Screen } from '@/components'
import { useAuth } from '@/contexts'
import { createBillingCheckout, ensureFreshSession } from '@/lib/api'
import {
  BILLING_INTERVAL_OPTIONS,
  DEFAULT_BILLING_INTERVAL,
  formatProPrice,
  PRO_DEVICE_LIMIT,
  type BillingInterval
} from '@/lib/billing-product'
import { isPlanEntitled } from '@/lib/settings'
import { useSettingsStore } from '@/store'
import type { PlanTier, SubscriptionStatus } from '@/types/settings.types'
import {
  SettingsActionRow,
  SettingsGroup,
  SettingsInfoRow,
  SettingsSegmentedRow
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

type SectionSubscriptionProps = {
  isOpen: boolean
}

export default function SectionSubscription({
  isOpen
}: SectionSubscriptionProps) {
  const { user } = useAuth()
  const settings = useSettingsStore(s => s.settings)
  const refreshSubscription = useSettingsStore(s => s.refreshSubscription)
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(
    DEFAULT_BILLING_INTERVAL
  )
  const [isUpgrading, setIsUpgrading] = useState(false)

  useEffect(() => {
    if (isOpen && user) void refreshSubscription()
  }, [isOpen, user, refreshSubscription])

  const handleUpgrade = async () => {
    const session = await ensureFreshSession()
    if (!session) return
    setIsUpgrading(true)
    try {
      const { url } = await createBillingCheckout(session.accessToken, {
        interval: billingInterval
      })
      if (
        url.startsWith('http') &&
        !url.startsWith(window.location.origin)
      ) {
        window.location.assign(url)
        return
      }
      await refreshSubscription()
    } catch {
      toast.error('Could not start checkout')
    } finally {
      setIsUpgrading(false)
    }
  }

  const sub = settings?.subscription
  const plan = sub?.plan ?? 'free'
  const isEntitled = sub ? isPlanEntitled(sub, 'pro') : false
  const purchasedPaid = plan === 'pro' || plan === 'pro_plus'

  return (
    <Screen isOpen={isOpen}>
      <Header>
        <BackButton />
        <span className="font-bold">Subscription</span>
        <span className="w-7" aria-hidden />
      </Header>

      <div className="flex flex-col gap-6 overflow-y-auto h-[92dvh] p-4 pb-30">
        {!user ? (
          <SettingsGroup footer="Sign in to subscribe when you want cloud sync or study reminders. The local app stays free.">
            <SettingsInfoRow label="Plan" value="Free" />
          </SettingsGroup>
        ) : (
          <>
            <SettingsGroup
              label="Current plan"
              footer={
                isEntitled
                  ? undefined
                  : 'Free includes the full local study app. Sync and notifications unlock with Pro — no paywall at sign-in.'
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

            {!isEntitled && (
              <SettingsGroup
                label="Pro"
                footer={`Cloud sync, study notifications, and up to ${PRO_DEVICE_LIMIT} devices. Prices shown before tax.`}
              >
                <SettingsSegmentedRow
                  label="Billing"
                  value={billingInterval}
                  options={BILLING_INTERVAL_OPTIONS}
                  onChange={value =>
                    setBillingInterval(value as BillingInterval)
                  }
                />
                <SettingsInfoRow
                  label="Selected"
                  value={formatProPrice(billingInterval)}
                />
                <SettingsActionRow
                  label={`Upgrade — ${formatProPrice(billingInterval)}`}
                  onClick={() => void handleUpgrade()}
                  disabled={isUpgrading}
                />
              </SettingsGroup>
            )}

            {purchasedPaid && isEntitled && (
              <SettingsGroup footer="Billing management is coming soon.">
                <SettingsActionRow
                  label="Manage billing"
                  onClick={() => {}}
                  disabled
                />
              </SettingsGroup>
            )}
          </>
        )}
      </div>
    </Screen>
  )
}
