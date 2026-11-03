#!/bin/sh
# Encrypted Postgres dumps for the unpaid beta single-VM deploy.
# Requires: pg_dump, gzip, openssl; BACKUP_ENCRYPTION_KEY (passphrase).
set -eu

INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
KEEP="${BACKUP_KEEP_COUNT:-7}"
DIR="${BACKUP_DIR:-/backups}"

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "BACKUP_ENCRYPTION_KEY is required" >&2
  exit 1
fi

mkdir -p "$DIR"

while true; do
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  out="$DIR/spaced_rep_${stamp}.sql.gz.enc"
  echo "Writing $out"
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
    -h "${POSTGRES_HOST:-postgres}" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --no-owner --no-acl \
    | gzip \
    | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_KEY \
    >"$out"

  # Keep the newest KEEP files; delete the rest.
  # shellcheck disable=SC2012
  ls -1t "$DIR"/spaced_rep_*.sql.gz.enc 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
    rm -f "$old"
  done

  sleep "$INTERVAL"
done
