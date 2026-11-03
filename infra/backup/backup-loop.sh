#!/bin/sh
# Runs backup.sh forever: every BACKUP_INTERVAL_SECONDS after a success, and
# every BACKUP_RETRY_SECONDS after a failure (backup.sh has already alerted).
set -eu

INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
RETRY="${BACKUP_RETRY_SECONDS:-900}"
HERE="$(dirname "$0")"

if [ -z "${BACKUP_S3_BUCKET:-}" ]; then
  echo "backup: WARNING: BACKUP_S3_BUCKET is not set; backups will not leave this host" >&2
fi
if [ -z "${BACKUP_HEARTBEAT_URL:-}" ]; then
  echo "backup: WARNING: BACKUP_HEARTBEAT_URL is not set; nobody is alerted when backups fail or stop" >&2
fi

while true; do
  if sh "$HERE/backup.sh"; then
    sleep "$INTERVAL"
  else
    sleep "$RETRY"
  fi
done
