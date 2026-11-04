-- ADR-1: server-assigned per-user monotonic sequence as the pull cursor and
-- tombstone purge boundary. `updated_at` stays for LWW only.

ALTER TABLE "users" ADD COLUMN "sync_seq" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "topics" ADD COLUMN "server_seq" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "cards" ADD COLUMN "server_seq" BIGINT NOT NULL DEFAULT 0;

-- Backfill: number every existing row per user in the order the old cursor
-- would have delivered it (updated_at, then id), topics and cards sharing one
-- sequence. A device holding an old cursor re-pulls everything (idempotent).
UPDATE "topics" t
SET "server_seq" = r.seq
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at, id) AS seq
  FROM "topics"
) r
WHERE t.id = r.id;

UPDATE "cards" c
SET "server_seq" = r.seq + COALESCE(tm.n, 0)
FROM (
  SELECT id, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at, id) AS seq
  FROM "cards"
) r
LEFT JOIN (
  SELECT user_id, COUNT(*) AS n FROM "topics" GROUP BY user_id
) tm ON tm.user_id = r.user_id
WHERE c.id = r.id;

UPDATE "users" u
SET "sync_seq" =
  (SELECT COUNT(*) FROM "topics" t WHERE t.user_id = u.id) +
  (SELECT COUNT(*) FROM "cards" c WHERE c.user_id = u.id);

DROP INDEX IF EXISTS "topics_user_id_updated_at_idx";
DROP INDEX IF EXISTS "cards_user_id_updated_at_idx";
CREATE INDEX "topics_user_id_server_seq_idx" ON "topics"("user_id", "server_seq");
CREATE INDEX "cards_user_id_server_seq_idx" ON "cards"("user_id", "server_seq");

-- Existing devices re-pull from the start once, after which they track seq.
ALTER TABLE "sync_devices" ADD COLUMN "last_pulled_seq" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "sync_devices" DROP COLUMN "last_pulled_at";
