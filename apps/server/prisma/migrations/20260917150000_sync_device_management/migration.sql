ALTER TABLE "sync_devices"
ADD COLUMN "name" TEXT,
ADD COLUMN "revoked_at" TIMESTAMPTZ;

DROP INDEX IF EXISTS "sync_devices_user_id_last_seen_at_idx";

CREATE INDEX "sync_devices_user_id_revoked_at_last_seen_at_idx"
ON "sync_devices"("user_id", "revoked_at", "last_seen_at");
