# Testing

Shared Vitest + Playwright infrastructure for the monorepo.

## Layers

| Layer           | Runner             | Scope                                   | Needs DB/Redis? |
| --------------- | ------------------ | --------------------------------------- | --------------- |
| **Unit**        | Vitest             | Pure logic (mappers, codecs, factories) | No              |
| **Integration** | Vitest + Supertest | Express API via `createApp()`           | Yes             |
| **E2E**         | Playwright         | Full client + server in browsers        | Yes             |

## One-time local setup

```bash
# 1. Start Postgres + Redis
pnpm docker:up

# 2. Create the isolated test database (once)
docker compose exec -T postgres \
  psql -U postgres -c "CREATE DATABASE spaced_rep_test OWNER spaced_rep;"

# 3. Copy test env
cp .env.test.example .env.test

# 4. Apply migrations to the test DB
pnpm test:db:prepare

# 5. Install Playwright browsers (e2e only)
pnpm exec playwright install
# If WebKit fails to launch on Linux:
#   sudo pnpm exec playwright install-deps
```

`.env.test` points at `spaced_rep_test` on port `5433` and Redis DB index `1` so tests never touch the development database.

## Commands

```bash
pnpm test                 # all Vitest projects (unit + integration)
pnpm test:unit            # unit only (no DB)
pnpm test:integration     # server API + DB/Redis
pnpm test:coverage        # Vitest with V8 coverage report
pnpm test:watch           # Vitest watch mode

pnpm test:e2e             # Playwright (chromium, firefox, webkit)
pnpm test:e2e:ui          # Playwright UI mode
pnpm test:e2e:debug       # Playwright debug mode
pnpm test:e2e:report      # open last HTML report

pnpm test:ci              # unit → integration → e2e (sequential local CI smoke)
pnpm test:testing:typecheck
```

Filter a single Vitest project:

```bash
pnpm exec vitest run --project client
pnpm exec vitest run --project server
pnpm exec vitest run --project server-integration
pnpm exec vitest run --project sync-protocol
pnpm exec vitest run --project testing
```

Filter Playwright by browser:

```bash
pnpm test:e2e --project=chromium
```

## Directory layout

```
testing/                     # shared helpers, factories, fixtures, setup
  config/                    # env loader, constants
  db/                        # Prisma client, migrate, truncate, faker seed
  redis/                     # FLUSHDB for test Redis DB
  factories/                 # user / topic / card builders
  helpers/
    auth/                    # OTP, session, OAuth, storageState scaffolds
    webauthn/                # Playwright virtual authenticator helpers
    http/                    # Supertest agent around createApp()
  fixtures/                  # Playwright fixture modules
  setup/                     # Vitest + Playwright global/setup hooks
e2e/
  fixtures.ts                # default { test, expect } for specs
  tests/
    smoke/                   # app-loads.spec.ts
    auth/                    # future OTP / OAuth specs
    passkeys/                # future WebAuthn specs
apps/client/**/*.test.ts(x)  # client unit tests
apps/server/**/*.test.ts     # server unit tests
apps/server/**/*.integration.test.ts
packages/sync-protocol/**/*.test.ts
```

## Naming conventions

| Kind        | Pattern                 | Example                      |
| ----------- | ----------------------- | ---------------------------- |
| Unit        | `*.test.ts`             | `mappers.test.ts`            |
| Integration | `*.integration.test.ts` | `health.integration.test.ts` |
| E2E         | `*.spec.ts`             | `app-loads.spec.ts`          |
| Factory     | `*.factory.ts`          | `user.factory.ts`            |
| Builder     | `*.builder.ts`          | `sync-mutation.builder.ts`   |
| Fixture     | `*.fixture.ts`          | `auth.fixture.ts`            |

## Writing tests

### Unit

Colocate next to the module (server / sync-protocol) or under `src/lib/__tests__/` (client). Prefer pure functions — no Prisma, Redis, or network.

### Integration

1. Put the file under `apps/server/src/**/*.integration.test.ts`.
2. Import `createTestAgent` from `testing/helpers/http/supertest-app`.
3. Use factories from `testing/factories` for DB rows — avoid hardcoded UUIDs/emails.
4. Setup already truncates tables and flushes Redis before each test.

```ts
import { createTestAgent } from '../../../testing/helpers/http/supertest-app.js'

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const agent = await createTestAgent()
    const res = await agent.get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
```

### E2E

1. Add a `*.spec.ts` under `e2e/tests/<area>/`.
2. Import `{ test, expect }` from `e2e/fixtures.ts` (or auth/webauthn fixture modules when needed).
3. Viewports are mobile-sized (`390×844`) because the app gates desktop widths >640px.

Auth / Passkey helpers are ready but unused by specs yet:

- Email OTP: `testing/helpers/auth/email-otp.ts`
- Sessions / storageState: `testing/helpers/auth/session.ts`, `storage-state.ts`
- Virtual WebAuthn: `testing/helpers/webauthn/virtual-authenticator.ts` (Playwright ≥ 1.61)

### Factories

```ts
import { userFactory, topicFactory } from '../testing/index.js'

const user = userFactory.build() // in-memory
const saved = await userFactory.create() // persists (integration/e2e)
const topic = await topicFactory.create({ userId: saved.id, title: 'Spanish' })
```

Faker is seeded (`42`) in integration setup for deterministic data.

## Database strategy

- **Isolated DB:** `spaced_rep_test` (never the compose default `spaced_rep` DB).
- **Migrations:** applied once per Vitest integration / Playwright run via global setup.
- **Cleanup:** `TRUNCATE ... CASCADE` + Redis `FLUSHDB` before each integration test.
- Prefer truncate/reseed over transaction rollback — handlers use the module-level Prisma client and Redis outside a single transaction.

## Environment

| File                                        | Role                    |
| ------------------------------------------- | ----------------------- |
| `[.env.test.example](../.env.test.example)` | Template (committed)    |
| `.env.test`                                 | Local copy (gitignored) |

`RESEND_API_KEY=re_placeholder` + `NODE_ENV=test` stores OTP codes in Redis at `otp:dev:<email>` for auth helpers.

## CI

`[.github/workflows/tests.yml](../.github/workflows/tests.yml)` runs three parallel jobs on push to `main` and on PRs:

1. **Unit** — coverage artifact
2. **Integration** — Postgres 17 + Redis 7 service containers
3. **E2E** — same services + Playwright browsers (cached) + report artifacts

CI remaps compose ports (`5433→5432`, `6380→6379`) to the Actions service host ports.

## Debugging

| Need                    | How                                                     |
| ----------------------- | ------------------------------------------------------- |
| Vitest watch            | `pnpm test:watch`                                       |
| Vitest single file      | `pnpm exec vitest run path/to/file.test.ts`             |
| Playwright UI           | `pnpm test:e2e:ui`                                      |
| Playwright headed debug | `pnpm test:e2e:debug`                                   |
| Last HTML report        | `pnpm test:e2e:report`                                  |
| Failed e2e traces       | Auto-recorded on first retry; open from the HTML report |
| Coverage HTML           | `pnpm test:coverage` → open `coverage/index.html`       |

IDE: point the Vitest extension at the root `[vitest.config.ts](../vitest.config.ts)` and the Playwright extension at `[playwright.config.ts](../playwright.config.ts)`.
