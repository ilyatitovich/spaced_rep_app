#!/bin/sh
# Restore a backup made by backup.sh (or a legacy openssl `.sql.gz.enc` one)
# into a database and check it is not empty.
#
#   TARGET_DATABASE_URL=postgresql://... BACKUP_ENCRYPTION_KEY=... \
#     restore.sh <file | s3://bucket/key | latest>
#
# Optional:
#   SOURCE_DATABASE_URL  compare per-table row counts with this database (a drill
#                        against a quiet source, or CI); otherwise only "not empty" is checked
#   RESTORE_FORCE=1      restore into a target that already has tables
#   BACKUP_DIR           where `latest` looks (default /backups)
#   BACKUP_S3_*          same variables as backup.sh, used for s3:// sources
#
# Point TARGET_DATABASE_URL at a scratch database, never at production by accident.
set -eu
umask 077

fail() {
  echo "restore: FAILED: $*" >&2
  exit 1
}

src="${1:-}"
[ -n "$src" ] || fail "usage: restore.sh <file | s3://bucket/key | latest>"
[ -n "${TARGET_DATABASE_URL:-}" ] || fail "TARGET_DATABASE_URL is required"
[ -n "${BACKUP_ENCRYPTION_KEY:-}" ] || fail "BACKUP_ENCRYPTION_KEY is required"

work="$(mktemp -d)"
cleanup() {
  gpgconf --kill gpg-agent >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT
GNUPGHOME="$work/gnupg"
export GNUPGHOME
mkdir -m 700 "$GNUPGHOME"
printf '%s' "$BACKUP_ENCRYPTION_KEY" >"$work/passphrase"

case "$src" in
  latest)
    # shellcheck disable=SC2012
    src="$(ls -1t "${BACKUP_DIR:-/backups}"/spaced_rep_*.sql.gz.gpg "${BACKUP_DIR:-/backups}"/spaced_rep_*.sql.gz.enc 2>/dev/null | head -n 1)"
    [ -n "$src" ] || fail "no backups found in ${BACKUP_DIR:-/backups}"
    ;;
  s3://*)
    AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID:-}" \
      AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY:-}" \
      AWS_DEFAULT_REGION="${BACKUP_S3_REGION:-auto}" \
      AWS_REQUEST_CHECKSUM_CALCULATION=when_required \
      AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
      aws s3 cp "$src" "$work/download" \
      ${BACKUP_S3_ENDPOINT:+--endpoint-url "$BACKUP_S3_ENDPOINT"} --only-show-errors ||
      fail "could not download $src"
    case "$src" in
      *.enc) mv "$work/download" "$work/download.enc" && src="$work/download.enc" ;;
      *) mv "$work/download" "$work/download.gpg" && src="$work/download.gpg" ;;
    esac
    ;;
esac
[ -f "$src" ] || fail "no such file: $src"
echo "restore: using $src"

# --- decrypt + decompress -------------------------------------------------
case "$src" in
  *.gpg)
    gpg --batch --yes --quiet --no-tty --pinentry-mode loopback \
      --passphrase-file "$work/passphrase" --decrypt --output "$work/dump.sql.gz" "$src" ||
      fail "decryption failed (wrong BACKUP_ENCRYPTION_KEY, or the file was modified or truncated)"
    ;;
  *.enc)
    openssl enc -d -aes-256-cbc -pbkdf2 -pass file:"$work/passphrase" \
      -in "$src" -out "$work/dump.sql.gz" ||
      fail "decryption failed (wrong BACKUP_ENCRYPTION_KEY or corrupt file)"
    ;;
  *) fail "unknown backup type (expected .gpg or .enc): $src" ;;
esac
gzip -t "$work/dump.sql.gz" || fail "backup is not valid gzip after decryption"
gzip -dc "$work/dump.sql.gz" >"$work/dump.sql" || fail "gunzip failed"

# --- refuse to clobber a populated database -------------------------------
existing="$(psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -At \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")" ||
  fail "cannot connect to TARGET_DATABASE_URL"
if [ "$existing" != "0" ] && [ "${RESTORE_FORCE:-}" != "1" ]; then
  fail "target already has $existing tables; use a scratch database or set RESTORE_FORCE=1"
fi

psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -q --single-transaction -f "$work/dump.sql" \
  >/dev/null || fail "psql could not apply the dump"

# --- row-count check -------------------------------------------------------
# One query per database: exact count(*) for every public base table.
COUNTS_SQL="SELECT table_name || ' ' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name"

row_counts() {
  psql "$1" -v ON_ERROR_STOP=1 -At -c "$COUNTS_SQL"
}

restored="$(row_counts "$TARGET_DATABASE_URL")" || fail "could not count restored rows"
tables="$(printf '%s\n' "$restored" | grep -c . || true)"
rows="$(printf '%s\n' "$restored" | awk 'NF { total += $2 } END { print total + 0 }')"
[ "$tables" -gt 0 ] || fail "restore produced no tables"
[ "$rows" -gt 0 ] || fail "restore produced $tables tables but no rows"

if [ -n "${SOURCE_DATABASE_URL:-}" ]; then
  expected="$(row_counts "$SOURCE_DATABASE_URL")" || fail "could not count source rows"
  if [ "$expected" != "$restored" ]; then
    echo "restore: row counts differ (source on the left, restored on the right):" >&2
    printf '%s\n' "$expected" >"$work/expected.txt"
    printf '%s\n' "$restored" >"$work/restored.txt"
    diff "$work/expected.txt" "$work/restored.txt" >&2 || true
    fail "restored row counts do not match the source"
  fi
  echo "restore: row counts match the source"
fi

printf '%s\n' "$restored"
echo "restore: OK ($tables tables, $rows rows)"
