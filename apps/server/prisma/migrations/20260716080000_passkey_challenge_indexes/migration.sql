-- Unique challenge for deterministic lookup and replay prevention
CREATE UNIQUE INDEX "auth_challenges_challenge_key" ON "auth_challenges"("challenge");

-- Faster exclude/list queries for active passkeys
CREATE INDEX "passkeys_user_id_active_idx" ON "passkeys"("user_id") WHERE "revoked_at" IS NULL;
