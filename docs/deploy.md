# Unpaid Public Beta Deploy

Single-VM API stack: Postgres, Redis (passworded), migrate-once, API, encrypted backups, Caddy. The Vite client stays on Vercel (`vercel.json`).

## Prerequisites

1. A VM with Docker + Compose, DNS for the API host, and an `.env` copied from `.env.example` with **production** secrets.
2. Replace `api.example.com` in `Caddyfile` with the real API hostname.
3. Set `GHCR_OWNER` to the GitHub org/user that owns the image (see `.github/workflows/publish-server.yml`).
4. Point an uptime check at `https://<api-host>/ready` — alert if status ≠ 200 or body `status` ≠ `ok` (checks Postgres + Redis). `/health` is the same probe (kept for older scripts); `/live` only asserts the process is up and should not be your external uptime signal.

## Required Production Env

| Variable                                                             | Notes                                                                                                    |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `NODE_ENV=production`                                                | Rejects `CORS_ORIGIN=*`, `dev-only` JWT/OTP placeholders, Turnstile test secrets; never loads test stubs |
| `CORS_ORIGIN`                                                        | Exact web + `chrome-extension://<id>` origins (no `*`)                                                   |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`                | Used by the `postgres` and `backup` services                                                             |
| `DATABASE_URL`                                                       | Compose hostname `postgres`                                                                              |
| `REDIS_PASSWORD`                                                     | Also embed in `REDIS_URL=redis://:<password>@redis:6379`                                                 |
| `JWT_SECRET` / `OTP_PEPPER`                                          | ≥32 chars, not the example placeholders                                                                  |
| `TURNSTILE_SECRET_KEY`                                               | Real Cloudflare secret                                                                                   |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URIS` | Google OAuth web client; redirect URIs must match the deployed client                                    |
| `RESEND_API_KEY` / `EMAIL_FROM`                                      | Email OTP delivery; `EMAIL_FROM` must be a verified sender                                               |
| `WEBAUTHN_RP_ID` / `WEBAUTHN_RP_NAME` / `WEBAUTHN_ORIGIN`            | Passkeys: RP ID is the client host (no scheme), origin is the exact client origin                        |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`           | Web Push: `npx web-push generate-vapid-keys`; subject is a real `mailto:` or `https:` URL                |
| `BACKUP_ENCRYPTION_KEY`                                              | gpg passphrase for dumps. Keep a copy off the VM (see Backups)                                           |
| `BACKUP_S3_*` / `BACKUP_HEARTBEAT_URL`                               | Offsite copy bucket and failure alert (see Backups)                                                      |
| `BETA_OPEN_PRO`                                                      | Defaults to `false`. Set `true` explicitly only to grant Pro without Lemon during the unpaid beta        |
| `LEMONSQUEEZY_API_KEY`                                               | Leave empty; checkout stays closed until paid phase                                                      |

Media (`R2_*`), `EXTENSION_REDIRECT_URIS`, and `SENTRY_DSN` are optional; see `.env.example`.

## Bring Up

```bash
# On the VM, after .env + Caddyfile are filled in:
export GHCR_OWNER=<github-owner>
export IMAGE_TAG=latest   # or a sha tag from GHCR
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

`migrate` runs `prisma migrate deploy` once per `up` and must succeed before `server` starts. Backups land in the `backup_data` volume as `spaced_rep_*.sql.gz.gpg` and are copied offsite (see Backups).

## Backups

The `backup` service (`infra/backup/`, built from its own small image) runs `backup.sh` every `BACKUP_INTERVAL_SECONDS`:

1. `pg_dump`, then validate: non-trivial size, the `PostgreSQL database dump complete` trailer, at least one `CREATE TABLE`. An empty or truncated dump is discarded, never stored.
2. gzip, then encrypt with `gpg` (AES256, integrity protected, so a modified file fails to decrypt instead of restoring garbage).
3. Decrypt and gunzip the result once to prove the file is recoverable with the configured key.
4. Copy to `s3://$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX/` (use a dedicated R2 bucket and a token scoped to it; add a lifecycle rule such as 90 days for retention). Local copies are pruned to `BACKUP_KEEP_COUNT`.
5. Ping `BACKUP_HEARTBEAT_URL` on success, `<url>/fail` on any failure. Use a dead-man's-switch such as healthchecks.io with the period set to a bit more than `BACKUP_INTERVAL_SECONDS`: it also alerts when the container or the VM stops running, which an in-process alert cannot. After a failure the loop retries every `BACKUP_RETRY_SECONDS`.

`BACKUP_ENCRYPTION_KEY` is the only way to read a backup. Keep a copy in a password manager that does not live on the VM. Rotating it makes older backups readable only with the old key, so record which key covers which dates.

### Restore

`restore.sh` decrypts a backup, refuses a target that already has tables (unless `RESTORE_FORCE=1`), applies the dump in one transaction and fails if the result has no tables or rows. Legacy `.sql.gz.enc` (openssl) backups are still accepted.

```bash
# Newest local backup into a scratch database (never point this at production by accident):
docker compose -f docker-compose.prod.yml exec postgres createdb -U "$POSTGRES_USER" scratch
docker compose -f docker-compose.prod.yml run --rm --no-deps \
  -e TARGET_DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/scratch" \
  --entrypoint sh backup /scripts/restore.sh latest

# Straight from the offsite bucket (pass the s3:// URL instead of `latest`; BACKUP_S3_* must be set):
#   ... /scripts/restore.sh s3://$BACKUP_S3_BUCKET/db/spaced_rep_<stamp>.sql.gz.gpg
```

Add `-e SOURCE_DATABASE_URL=postgresql://.../$POSTGRES_DB` to compare per-table row counts with the live database (only meaningful when it is quiet; otherwise expect small differences and read the printed counts).

### Quarterly Drill

CI runs `infra/smoke/backup-restore.sh` on every change (seed Postgres 17, back up with the real image, restore into a scratch database, compare row counts), which proves the tooling. It cannot prove your VM and bucket, so once a quarter, and after any change to the key or the bucket:

1. Restore the newest **offsite** backup (`s3://...`) into a scratch database on a different machine, using only the key from your password manager.
2. Confirm the printed table list and row counts look plausible against production, and that `_prisma_migrations` ends at the latest migration.
3. Drop the scratch database and note the date and the backup file used.

## Observability

### Log Drain

Containers log JSON to stdout (`pino` + `pino-http`, Authorization/cookies/emails/billing fields redacted, `x-request-id` on responses). Ship with whatever collector you already run on the host (Vector, Fluent Bit, Datadog agent, etc.) by scraping Docker json-file logs — no in-process drain is required for beta.

### Sentry

Set `SENTRY_DSN` on the API (same project as the client is fine). Unhandled 500s and process-level exceptions are reported; emails and billing payloads are scrubbed in `beforeSend`. Leave it empty to disable.

### Metrics

`GET /metrics` exposes Prometheus text: push latency, pull page size, and open sync WebSocket connections. Scrape from the host or a sidecar; the endpoint is unauthenticated — keep the API host private or put basic auth in Caddy if you expose it.

### Uptime Alert

Use an external checker (UptimeRobot, Better Stack, healthchecks.io HTTP check, etc.) against `https://<api-host>/ready` every 1–5 minutes. Alert on non-200 or body `status` ≠ `ok`. Pair this with the backup dead-man's-switch (`BACKUP_HEARTBEAT_URL`) so a quiet VM still pages you.

## Client

Deploy the PWA to Vercel with `VITE_API_URL=https://<api-host>`. Keep Lemon checkout UI closed; set `BETA_OPEN_PRO=true` on the API to grant Pro during the beta.

### Security Headers

The root `vercel.json` sets the CSP, HSTS, `nosniff`, referrer and permissions policies, and the cache headers (`no-cache` for `sw.js`, `index.html`, the manifest; `immutable` for `/assets/*`). Vercel ignores `public/_headers`, so do not add one. `testing/security/vercel-headers.test.ts` guards the policy.

`script-src` allows only `'self'` and Cloudflare Turnstile. `connect-src` allows any `https:`/`wss:` origin because the API host, Sentry ingest host and presigned R2 URLs are not known at static-config time. Once those hosts are fixed, replace `https: wss:` with the explicit origins to limit where an injected script could send data. After deploying, check the headers on the preview URL: `curl -sI https://<preview-host>/ | grep -i -E 'content-security|strict-transport|x-content-type|referrer|permissions'`, then load the app with the browser console open and confirm there are no CSP violations (sign-in with Turnstile, an image card, Anki import).

### Dependency Hygiene

CI runs `pnpm audit:prod` (fails on high or critical advisories in production dependencies) and Dependabot opens weekly update PRs. Transitive floors live under `overrides` in `pnpm-workspace.yaml`; drop an entry once its parent ships a patched range.

## CI Smoke Test

CI builds the production image and boots it against throwaway Postgres and Redis (`infra/smoke/boot-image.sh`): it runs `prisma migrate deploy`, starts the server with `NODE_ENV=production` and asserts `/health` is `ok`. Run it locally with the same script.
