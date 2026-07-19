-- Shared app schema — must stay identical to Express/Prisma public tables
-- (except auth.* and Express-only auth tables: sessions, refresh_tokens, etc.).
-- Source of truth for column/index/constraint shape: apps/server/prisma/migrations.

CREATE TABLE IF NOT EXISTS public.topics (
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  pivot BIGINT NOT NULL,
  week JSONB NOT NULL,
  next_update_date BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT topics_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.cards (
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  topic_id UUID NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  data JSONB NOT NULL,
  review_date BIGINT,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT cards_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.sync_devices (
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  last_pulled_at TIMESTAMPTZ NOT NULL DEFAULT 'epoch'::timestamptz,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  CONSTRAINT sync_devices_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.sync_operations (
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  op_id TEXT NOT NULL,
  device_id UUID NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sync_operations_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS topics_user_id_updated_at_idx
  ON public.topics (user_id, updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS topics_user_title_unique
  ON public.topics (user_id, title)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS cards_user_id_updated_at_idx
  ON public.cards (user_id, updated_at);

CREATE INDEX IF NOT EXISTS cards_topic_id_idx ON public.cards (topic_id);

CREATE INDEX IF NOT EXISTS sync_devices_user_id_last_seen_at_idx
  ON public.sync_devices (user_id, last_seen_at);

CREATE UNIQUE INDEX IF NOT EXISTS sync_operations_user_id_op_id_key
  ON public.sync_operations (user_id, op_id);

CREATE INDEX IF NOT EXISTS sync_operations_user_id_applied_at_idx
  ON public.sync_operations (user_id, applied_at);

ALTER TABLE public.topics
  DROP CONSTRAINT IF EXISTS topics_user_id_fkey;
ALTER TABLE public.topics
  ADD CONSTRAINT topics_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.cards
  DROP CONSTRAINT IF EXISTS cards_user_id_fkey;
ALTER TABLE public.cards
  ADD CONSTRAINT cards_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.cards
  DROP CONSTRAINT IF EXISTS cards_topic_id_fkey;
ALTER TABLE public.cards
  ADD CONSTRAINT cards_topic_id_fkey
  FOREIGN KEY (topic_id) REFERENCES public.topics (id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.sync_devices
  DROP CONSTRAINT IF EXISTS sync_devices_user_id_fkey;
ALTER TABLE public.sync_devices
  ADD CONSTRAINT sync_devices_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.sync_operations
  DROP CONSTRAINT IF EXISTS sync_operations_user_id_fkey;
ALTER TABLE public.sync_operations
  ADD CONSTRAINT sync_operations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Settings / billing enums + tables (match Prisma user_settings migration)
DO $$ BEGIN
  CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'PRO_PLUS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM (
    'ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'INCOMPLETE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BillingProvider" AS ENUM ('NONE', 'STRIPE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'EMAIL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID NOT NULL,
  theme "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
  language VARCHAR(35) NOT NULL DEFAULT 'en',
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by_device_id UUID,
  CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS public.user_learning_settings (
  user_id UUID NOT NULL,
  week_starts_on INTEGER NOT NULL DEFAULT 0,
  daily_new_card_limit INTEGER,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by_device_id UUID,
  CONSTRAINT user_learning_settings_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_learning_settings_week_starts_on_check
    CHECK (week_starts_on BETWEEN 0 AND 6)
);

CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  user_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by_device_id UUID,
  CONSTRAINT user_notification_settings_pkey PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS public.notification_reminders (
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  time_local TIME(0) NOT NULL,
  days_of_week SMALLINT NOT NULL DEFAULT 127,
  channel "NotificationChannel" NOT NULL DEFAULT 'PUSH',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT notification_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT notification_reminders_days_of_week_check
    CHECK (days_of_week BETWEEN 0 AND 127)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id UUID NOT NULL,
  plan "PlanTier" NOT NULL DEFAULT 'FREE',
  status "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  provider "BillingProvider" NOT NULL DEFAULT 'NONE',
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  server_updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT subscriptions_pkey PRIMARY KEY (user_id)
);

CREATE INDEX IF NOT EXISTS notification_reminders_user_id_sort_order_idx
  ON public.notification_reminders (user_id, sort_order);

CREATE INDEX IF NOT EXISTS notification_reminders_enabled_time_local_idx
  ON public.notification_reminders (enabled, time_local);

CREATE INDEX IF NOT EXISTS subscriptions_status_current_period_end_idx
  ON public.subscriptions (status, current_period_end);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_subscription_id_key
  ON public.subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.user_learning_settings
  DROP CONSTRAINT IF EXISTS user_learning_settings_user_id_fkey;
ALTER TABLE public.user_learning_settings
  ADD CONSTRAINT user_learning_settings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.user_notification_settings
  DROP CONSTRAINT IF EXISTS user_notification_settings_user_id_fkey;
ALTER TABLE public.user_notification_settings
  ADD CONSTRAINT user_notification_settings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.notification_reminders
  DROP CONSTRAINT IF EXISTS notification_reminders_settings_fkey;
ALTER TABLE public.notification_reminders
  ADD CONSTRAINT notification_reminders_settings_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_notification_settings (user_id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.notification_reminders
  DROP CONSTRAINT IF EXISTS notification_reminders_user_fkey;
ALTER TABLE public.notification_reminders
  ADD CONSTRAINT notification_reminders_user_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE ON UPDATE CASCADE;
