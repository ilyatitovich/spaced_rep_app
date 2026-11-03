# Unpaid public beta deploy

Single-VM API stack: Postgres, Redis (passworded), migrate-once, API, encrypted backups, Caddy. The Vite client stays on Vercel (`vercel.json`).

## Prerequisites

1. A VM with Docker + Compose, DNS for the API host, and an `.env` copied from `.env.example` with **production** secrets.
2. Replace `api.example.com` in `Caddyfile` with the real API hostname.
3. Set `GHCR_OWNER` to the GitHub org/user that owns the image (see `.github/workflows/publish-server.yml`).
4. Point an uptime check at `https://<api-host>/health` — alert if status ≠ 200 or body `status` ≠ `ok` (checks Postgres + Redis).

## Required production env

| Variable                    | Notes                                                                            |
| --------------------------- | -------------------------------------------------------------------------------- |
| `NODE_ENV=production`       | Rejects `CORS_ORIGIN=*`, `dev-only` JWT/OTP placeholders, Turnstile test secrets |
| `CORS_ORIGIN`               | Exact web + `chrome-extension://<id>` origins (no `*`)                           |
| `REDIS_PASSWORD`            | Also embed in `REDIS_URL=redis://:<password>@redis:6379`                         |
| `DATABASE_URL`              | Compose hostname `postgres`                                                      |
| `JWT_SECRET` / `OTP_PEPPER` | ≥32 chars, not the example placeholders                                          |
| `TURNSTILE_SECRET_KEY`      | Real Cloudflare secret                                                           |
| `BACKUP_ENCRYPTION_KEY`     | Passphrase for `openssl enc` dumps                                               |
| `BETA_OPEN_PRO=true`        | Grants Pro without Lemon for the unpaid beta                                     |
| `LEMONSQUEEZY_API_KEY`      | Leave empty; checkout stays closed until paid phase                              |

## Bring up

```bash
# On the VM, after .env + Caddyfile are filled in:
export GHCR_OWNER=<github-owner>
export IMAGE_TAG=latest   # or a sha tag from GHCR
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

`migrate` runs `prisma migrate deploy` once per `up` and must succeed before `server` starts. Backups land in the `backup_data` volume as `spaced_rep_*.sql.gz.enc`.

## Log drain

Containers log JSON to stdout (`pino` + `pino-http`, Authorization redacted, `x-request-id` on responses). Ship with whatever collector you already run on the host (Vector, Fluent Bit, Datadog agent, etc.) by scraping Docker json-file logs — no in-process drain is required for beta.

## Client

Deploy the PWA to Vercel with `VITE_API_URL=https://<api-host>`. Keep Lemon checkout UI closed; Pro comes from `BETA_OPEN_PRO`.
