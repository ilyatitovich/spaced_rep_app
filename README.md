# Spaced Repetition App

Local-first spaced repetition PWA: topics, rich flashcards, weekly levels, optional cloud sync.

Inspired by [Nicky Case’s explanation of spaced repetition](https://ncase.me/remember/).

## Features

- Weekly level-based review schedule
- Offline IndexedDB storage (source of truth)
- Text, image, code, and audio card blocks
- Anki import and JSON backup / restore
- Optional Express sync for signed-in Pro accounts (email OTP, Google, passkeys)
- PWA install / update prompts

Sync model (outbox, last-write-wins, tombstones, 3-device cap): **[docs/sync.md](docs/sync.md)**. Architecture notes: **[CONTEXT.md](CONTEXT.md)**. Unpaid beta API deploy: **[docs/deploy.md](docs/deploy.md)**.

## Tech Stack

| Layer  | Stack                                                                       |
| ------ | --------------------------------------------------------------------------- |
| Client | React 18, React Router 7, Zustand, Tailwind CSS v4, Vite, `vite-plugin-pwa` |
| Server | Express 5, Prisma 7, PostgreSQL 17, Redis 7                                 |
| Shared | `packages/sync-protocol`, `packages/sync-client`                            |
| Tests  | Vitest 5, Playwright, Stryker                                               |

Requires **Node 24.18** and **pnpm 12.3** (see `.node-version` and `packageManager` in `package.json`).

## Local Development

```bash
pnpm install
pnpm dev
```

Client: `http://localhost:5173`.

### Docker (Postgres + Redis + Server)

```bash
cp .env.example .env
cp apps/server/src/.env.example apps/server/src/.env
pnpm docker:up
```

- Compose `DATABASE_URL` uses hostname `postgres`.
- Host-side Prisma / server use `localhost:5433` (see `apps/server/src/.env.example`).

### Prisma

```bash
pnpm prisma:generate
pnpm prisma:migrate          # development
pnpm prisma:migrate:deploy   # CI / production
pnpm prisma:studio
```

## Testing

See **[testing/README.md](testing/README.md)** for setup, factories, and conventions.

```bash
pnpm test:unit
pnpm test:integration   # needs Docker + spaced_rep_test DB
pnpm test:e2e           # Playwright; CI uses --project=chromium
pnpm test:mutation      # Stryker; unit projects only
```

```bash
pnpm typecheck
pnpm lint               # oxlint
pnpm format:check
pnpm knip
pnpm jscpd
```

CI (`.github/workflows/tests.yml`) runs typecheck, lint, knip, unit tests with a V8 coverage artifact, integration tests, Chromium e2e, and jscpd on push to `main` and on pull requests. Unit, integration, and e2e run only when a file that suite covers has changed. Coverage is uploaded; there is no percentage gate.

## License

MIT
