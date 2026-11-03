#!/bin/sh
# One verified, encrypted Postgres backup. Exits non-zero (and pings the alert
# URL) on any failure, so a bad dump can never pass for a good one.
#
# Steps: pg_dump -> validate the dump -> gzip -> gpg (AES256, integrity
# protected) -> prove the artifact decrypts -> offsite copy -> prune -> heartbeat.
#
# Requires: pg_dump, gzip, gpg; aws (only when BACKUP_S3_BUCKET is set);
#           wget (only when BACKUP_HEARTBEAT_URL is set).
# POSIX sh on purpose: the postgres alpine image ships busybox ash, not bash,
# and each stage below is checked on its own instead of relying on `pipefail`.
set -eu
umask 077

DIR="${BACKUP_DIR:-/backups}"
KEEP="${BACKUP_KEEP_COUNT:-7}"
MIN_DUMP_BYTES="${BACKUP_MIN_DUMP_BYTES:-1024}"

log() { echo "backup: $*"; }

ping_heartbeat() {
  # $1: "" for success, "/fail" for failure. Never lets the alert path break the run.
  [ -n "${BACKUP_HEARTBEAT_URL:-}" ] || return 0
  wget -q -T 10 -O /dev/null "${BACKUP_HEARTBEAT_URL%/}$1" ||
    log "WARNING: could not reach BACKUP_HEARTBEAT_URL"
}

fail() {
  echo "backup: FAILED: $*" >&2
  ping_heartbeat /fail
  exit 1
}

[ -n "${BACKUP_ENCRYPTION_KEY:-}" ] || fail "BACKUP_ENCRYPTION_KEY is required"
: "${POSTGRES_USER:?POSTGRES_USER is required}" "${POSTGRES_DB:?POSTGRES_DB is required}"

mkdir -p "$DIR"
work="$(mktemp -d "$DIR/.work.XXXXXX")"
cleanup() {
  gpgconf --kill gpg-agent >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

# Keep gpg's state out of the user's home and out of the backup volume's listing.
GNUPGHOME="$work/gnupg"
export GNUPGHOME
mkdir -m 700 "$GNUPGHOME"
printf '%s' "$BACKUP_ENCRYPTION_KEY" >"$work/passphrase"

gpg_symmetric() {
  gpg --batch --yes --quiet --no-tty --pinentry-mode loopback \
    --passphrase-file "$work/passphrase" "$@"
}

# --- dump ---------------------------------------------------------------
PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_dump \
  -h "${POSTGRES_HOST:-postgres}" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-owner --no-acl \
  >"$work/dump.sql" || fail "pg_dump exited with an error"

dump_bytes="$(wc -c <"$work/dump.sql" | tr -d ' ')"
[ "$dump_bytes" -ge "$MIN_DUMP_BYTES" ] ||
  fail "dump is only $dump_bytes bytes (minimum $MIN_DUMP_BYTES); refusing to keep it"
# pg_dump writes this trailer last, so its absence means a truncated dump.
grep -q 'PostgreSQL database dump complete' "$work/dump.sql" ||
  fail "dump is truncated (no completion trailer)"
grep -q '^CREATE TABLE' "$work/dump.sql" ||
  fail "dump contains no tables"

# --- compress + encrypt -------------------------------------------------
gzip -c "$work/dump.sql" >"$work/dump.sql.gz" || fail "gzip failed"
rm -f "$work/dump.sql"
gpg_symmetric --symmetric --cipher-algo AES256 \
  --s2k-mode 3 --s2k-digest-algo SHA512 --s2k-count 65011712 \
  --output "$work/backup.gpg" "$work/dump.sql.gz" || fail "encryption failed"

# The artifact must decrypt and gunzip with the configured key, or it is worthless.
gpg_symmetric --decrypt --output "$work/verify.sql.gz" "$work/backup.gpg" ||
  fail "encrypted backup does not decrypt"
gzip -t "$work/verify.sql.gz" || fail "decrypted backup is not valid gzip"
rm -f "$work/verify.sql.gz" "$work/dump.sql.gz"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="spaced_rep_${stamp}.sql.gz.gpg"
mv "$work/backup.gpg" "$DIR/$name"
log "wrote $DIR/$name ($dump_bytes bytes of SQL)"

# --- offsite copy -------------------------------------------------------
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  # R2 rejects the newer aws-cli default checksums; only send them when required.
  AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID:-}" \
    AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY:-}" \
    AWS_DEFAULT_REGION="${BACKUP_S3_REGION:-auto}" \
    AWS_REQUEST_CHECKSUM_CALCULATION=when_required \
    AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
    aws s3 cp "$DIR/$name" "s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX:-db}/$name" \
    ${BACKUP_S3_ENDPOINT:+--endpoint-url "$BACKUP_S3_ENDPOINT"} --only-show-errors ||
    fail "offsite upload failed (local copy kept at $DIR/$name)"
  log "uploaded to s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX:-db}/$name"
else
  log "WARNING: BACKUP_S3_BUCKET is not set; this backup exists only on this host"
fi

# --- prune local copies (offsite retention is a bucket lifecycle rule) --
# shellcheck disable=SC2012
ls -1t "$DIR"/spaced_rep_*.sql.gz.gpg "$DIR"/spaced_rep_*.sql.gz.enc 2>/dev/null |
  tail -n +"$((KEEP + 1))" | while read -r old; do
  rm -f "$old"
done

ping_heartbeat ""
log "done"
