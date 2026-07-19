# Backend providers

The client selects a backend **once at init** via `VITE_BACKEND_PROVIDER`:

| Value | Auth | Sync | Settings |
|-------|------|------|----------|
| `custom` | Express JWT (`VITE_API_URL`) | Protobuf HTTP + optional WebSocket | Express `/settings` |
| `supabase` | Supabase Auth (Google only) | PostgREST HTTP LWW | PostgREST on shared tables |
| _(unset)_ | Local-only — no cloud | — | — |

Application code talks only to ports in [`src/providers`](../src/providers): `auth`, `sync`, `settings`. UI uses `auth.capabilities` (not the provider name) to show login methods.

## Schema compatibility

App tables (`users`, `topics`, `cards`, `sync_*`, settings/subscription) must stay **identical** between Express/Prisma and Supabase Postgres.

- Prisma migrations under `apps/server/prisma/migrations` are the source of truth.
- Mirror shared DDL into `apps/client/supabase/migrations`.
- Auth tables differ: Supabase `auth.*` vs Express `sessions` / `otp_codes` / etc.
- On Supabase, `auth.users` → `public.users` bridge keeps FKs on `public.users`.

## Switching providers

1. Deploy the custom server (or keep using Supabase).
2. Set `VITE_BACKEND_PROVIDER=custom` (or `supabase`) and the matching env vars.
3. Rebuild/redeploy the client — no application code changes.

Migrating existing user data between hosts is an ops task (`pg_dump`/`COPY` of shared tables + auth user mapping), not a code change.
