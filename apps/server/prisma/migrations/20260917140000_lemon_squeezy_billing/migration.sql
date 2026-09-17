-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'PAUSED';
ALTER TYPE "SubscriptionStatus" ADD VALUE 'UNPAID';

-- AlterEnum
ALTER TYPE "BillingProvider" ADD VALUE 'LEMON_SQUEEZY';

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "provider_variant_id" TEXT,
ADD COLUMN "provider_updated_at" TIMESTAMPTZ,
ADD COLUMN "last_verified_at" TIMESTAMPTZ,
ADD COLUMN "ends_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "subscriptions_status_ends_at_idx" ON "subscriptions"("status", "ends_at");

-- CreateTable
CREATE TABLE "billing_checkout_intents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan" "PlanTier" NOT NULL,
    "provider" "BillingProvider" NOT NULL DEFAULT 'LEMON_SQUEEZY',
    "provider_checkout_id" TEXT,
    "checkout_url" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_checkout_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" UUID NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "event_type" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "provider_event_id" TEXT,
    "payload" JSONB,
    "processed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_checkout_intents_user_id_plan_expires_at_idx" ON "billing_checkout_intents"("user_id", "plan", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_idempotency_key_key" ON "billing_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "billing_events_provider_event_type_idx" ON "billing_events"("provider", "event_type");

-- AddForeignKey
ALTER TABLE "billing_checkout_intents" ADD CONSTRAINT "billing_checkout_intents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
