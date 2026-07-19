-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'PRO_PLUS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('NONE', 'STRIPE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'EMAIL');

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" UUID NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "language" VARCHAR(35) NOT NULL DEFAULT 'en',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by_device_id" UUID,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_learning_settings" (
    "user_id" UUID NOT NULL,
    "week_starts_on" INTEGER NOT NULL DEFAULT 0,
    "daily_new_card_limit" INTEGER,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by_device_id" UUID,

    CONSTRAINT "user_learning_settings_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "user_learning_settings_week_starts_on_check" CHECK ("week_starts_on" BETWEEN 0 AND 6)
);

-- CreateTable
CREATE TABLE "user_notification_settings" (
    "user_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by_device_id" UUID,

    CONSTRAINT "user_notification_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "notification_reminders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "time_local" TIME(0) NOT NULL,
    "days_of_week" SMALLINT NOT NULL DEFAULT 127,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'PUSH',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_reminders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notification_reminders_days_of_week_check" CHECK ("days_of_week" BETWEEN 0 AND 127)
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "user_id" UUID NOT NULL,
    "plan" "PlanTier" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "provider" "BillingProvider" NOT NULL DEFAULT 'NONE',
    "provider_customer_id" TEXT,
    "provider_subscription_id" TEXT,
    "current_period_start" TIMESTAMPTZ,
    "current_period_end" TIMESTAMPTZ,
    "trial_ends_at" TIMESTAMPTZ,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMPTZ,
    "server_updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "notification_reminders_user_id_sort_order_idx" ON "notification_reminders"("user_id", "sort_order");

-- CreateIndex
CREATE INDEX "notification_reminders_enabled_time_local_idx" ON "notification_reminders"("enabled", "time_local");

-- CreateIndex
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "subscriptions"("status", "current_period_end");

-- Partial unique: only when provider subscription id is set
CREATE UNIQUE INDEX "subscriptions_provider_subscription_id_key"
  ON "subscriptions"("provider", "provider_subscription_id")
  WHERE "provider_subscription_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_learning_settings" ADD CONSTRAINT "user_learning_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_reminders" ADD CONSTRAINT "notification_reminders_settings_fkey" FOREIGN KEY ("user_id") REFERENCES "user_notification_settings"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_reminders" ADD CONSTRAINT "notification_reminders_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
