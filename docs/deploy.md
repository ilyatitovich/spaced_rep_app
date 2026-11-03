# Unpaid public beta deploy

Single-VM API stack: Postgres, Redis (passworded), migrate-once, API, encrypted backups, Caddy. The Vite client stays on Vercel (`vercel.json`).

## Prerequisites

1. A VM with Docker + Compose, DNS for the API host, and an `.env` copied from `.env.example` with **production** secrets.
2. Replace `api.example.com` in `Caddyfile` with the real API hostname.
3. Set `GHCR_OWNER` to the GitHub org/user that owns the image (see `.github/workflows/publish-server.yml`).
4. Point an uptime check at `https://<api-host>/health` — alert if status ≠ 200 or body `status` ≠ `ok` (checks Postgres + Redis).

## Required production env

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
| `BACKUP_ENCRYPTION_KEY`                                              | Passphrase for `openssl enc` dumps                                                                       |
| `BETA_OPEN_PRO`                                                      | Defaults to `false`. Set `true` explicitly only to grant Pro without Lemon during the unpaid beta        |
| `LEMONSQUEEZY_API_KEY`                                               | Leave empty; checkout stays closed until paid phase                                                      |

Media (`R2_*`) and `EXTENSION_REDIRECT_URIS` are optional; see `.env.example`.

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

Deploy the PWA to Vercel with `VITE_API_URL=https://<api-host>`. Keep Lemon checkout UI closed; set `BETA_OPEN_PRO=true` on the API to grant Pro during the beta.

### Security headers

The root `vercel.json` sets the CSP, HSTS, `nosniff`, referrer and permissions policies, and the cache headers (`no-cache` for `sw.js`, `index.html`, the manifest; `immutable` for `/assets/*`). Vercel ignores `public/_headers`, so do not add one. `testing/security/vercel-headers.test.ts` guards the policy.

`script-src` allows only `'self'` and Cloudflare Turnstile. `connect-src` allows any `https:`/`wss:` origin because the API host, Sentry ingest host and presigned R2 URLs are not known at static-config time. Once those hosts are fixed, replace `https: wss:` with the explicit origins to limit where an injected script could send data. After deploying, check the headers on the preview URL: `curl -sI https://<preview-host>/ | grep -i -E 'content-security|strict-transport|x-content-type|referrer|permissions'`, then load the app with the browser console open and confirm there are no CSP violations (sign-in with Turnstile, an image card, Anki import).

### Dependency hygiene

CI runs `pnpm audit:prod` (fails on high or critical advisories in production dependencies) and Dependabot opens weekly update PRs. Transitive floors live under `overrides` in `pnpm-workspace.yaml`; drop an entry once its parent ships a patched range.

## CI smoke test

CI builds the production image and boots it against throwaway Postgres and Redis (`infra/smoke/boot-image.sh`): it runs `prisma migrate deploy`, starts the server with `NODE_ENV=production` and asserts `/health` is `ok`. Run it locally with the same script.
