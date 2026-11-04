#!/usr/bin/env bash
# Backup restore drill: builds the real backup image, backs up a seeded
# Postgres 17, restores the newest backup into a scratch database and compares
# per-table row counts with the source. Proves the shipped scripts and tools
# (pg_dump, gnupg, psql) work together, not just that a file was written.
#
# Usage: infra/smoke/backup-restore.sh
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

RUN_ID="drill-$$"
NETWORK="${RUN_ID}-net"
VOLUME="${RUN_ID}-backups"
IMAGE="${BACKUP_IMAGE:-spacedrep-backup:drill}"
PG_PASSWORD="$(openssl rand -hex 16)"
KEY="$(openssl rand -hex 24)"
PG="${RUN_ID}-postgres"

cleanup() {
  docker rm -f "$PG" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [ -z "${BACKUP_IMAGE:-}" ]; then
  docker build -t "$IMAGE" infra/backup
fi

docker network create "$NETWORK" >/dev/null
docker volume create "$VOLUME" >/dev/null
docker run -d --name "$PG" --network "$NETWORK" \
  -e POSTGRES_USER=drill -e POSTGRES_PASSWORD="$PG_PASSWORD" -e POSTGRES_DB=source \
  postgres:17-alpine >/dev/null

echo "Waiting for Postgres..."
# pg_isready is true while initdb's temporary server is up. That server then
# exits and deletes the socket, so the next psql fails. Wait until init has
# finished and the real server accepts connections.
ready=0
for _ in $(seq 1 60); do
  if docker logs "$PG" 2>&1 | grep -F "PostgreSQL init process complete" >/dev/null \
    && docker exec "$PG" pg_isready -U drill -d source >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "Postgres did not become ready" >&2
  docker logs "$PG" >&2 || true
  exit 1
fi

psql_in() { docker exec -i "$PG" psql -U drill -v ON_ERROR_STOP=1 -q "$@"; }

# Awkward values on purpose: non-ASCII, quotes, newlines, dollar quoting, JSON.
psql_in -d source <<'SQL'
CREATE TABLE users (id int PRIMARY KEY, email text NOT NULL);
CREATE TABLE cards (id serial PRIMARY KEY, user_id int REFERENCES users, body jsonb);
CREATE TABLE empty_table (id int);
INSERT INTO users SELECT g, 'ü' || g || E'\n''"$$q' FROM generate_series(1, 50) g;
INSERT INTO cards (user_id, body)
  SELECT (g % 50) + 1, jsonb_build_object('n', g, 'text', 'héllo') FROM generate_series(1, 500) g;
SQL
psql_in -d postgres -c "CREATE DATABASE scratch"

drill() {
  docker run --rm --network "$NETWORK" -v "$VOLUME:/backups" \
    -e POSTGRES_HOST="$PG" -e POSTGRES_USER=drill -e POSTGRES_PASSWORD="$PG_PASSWORD" \
    -e POSTGRES_DB=source -e BACKUP_ENCRYPTION_KEY="$KEY" -e BACKUP_MIN_DUMP_BYTES=200 \
    -e TARGET_DATABASE_URL="postgresql://drill:${PG_PASSWORD}@${PG}:5432/scratch" \
    -e SOURCE_DATABASE_URL="postgresql://drill:${PG_PASSWORD}@${PG}:5432/source" \
    --entrypoint sh "$IMAGE" "$@"
}

echo "Backing up..."
drill /scripts/backup.sh
echo "Restoring the latest backup into a scratch database..."
drill /scripts/restore.sh latest

echo "OK: backup restored and row counts match the source"
