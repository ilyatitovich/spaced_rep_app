# Project Overview

**Spaced Repetition** is a mobile-first, offline-capable Progressive Web App for memorizing information via spaced repetition. Users create **topics**, add flashcards (**cards**) with text / image / code / audio blocks, and review them on a weekly, level-based schedule. The app is **local-first**: IndexedDB is the runtime source of truth; an optional Express backend (`VITE_API_URL`) syncs data for authenticated Pro users. Without `VITE_API_URL`, the app runs fully local.

Monorepo layout: `apps/client` (Vite PWA), `apps/server` (Express + Prisma + Redis), `apps/browser-extension`, `packages/sync-protocol`, `packages/sync-client`. Client ports live under `apps/client/src/providers` (`auth` / `sync` / `settings`).

See [docs/sync.md](docs/sync.md) for outbox, LWW, tombstones, and the 3-device cap.

_Confidence: High_

# Architecture

Layered, local-first client architecture with a one-directional dependency flow:

```
models / types      (domain entities + content shapes)
      ↓
lib/db.ts           (IndexedDB access: STORES, withTransaction)
lib/sync-serialize  (model ↔ row mapping, LWW comparator)
providers/          (AuthPort / SyncPort / SettingsPort → Express API)
      ↓
services/           (CRUD + sync engine; the only writers of persistence)
      ↓
store/ (Zustand)    (topics list, settings, screen stack)
contexts/           (Auth + Sync cross-cutting infra)
      ↓
pages / components  (UI; reads from store, contexts, or services)
```

Major building blocks:

- **Domain** (`src/models`, `src/types`) — entities and scheduling; no I/O.
- **Persistence** (`src/lib/db.ts`) — IndexedDB database `spacedRepApp` **v6**.
- **Providers** (`src/providers`) — Express ports when `VITE_API_URL` is set; otherwise local-only.
- **Services** (`src/services`) — CRUD, sync orchestration, settings, backup, push.
- **State** (`src/store`) — Zustand: topics, settings, screen stack.
- **Context** (`src/contexts`) — `AuthProvider`, `SyncProvider`.
- **UI** — React Router v7; auth methods gated by `auth.capabilities`.

Server (`apps/server`) is Express 5 + Prisma 7 + Redis. Schema source of truth: `apps/server/prisma`.

_Confidence: High_

# Directory Structure

Paths below are under `apps/client/` unless noted.

| Path               | Purpose                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| `src/models/`      | Domain: `topic.model.ts`, `card.model.ts` (`Card` class), `day.model.ts` (review-level scheduling). |
| `src/types/`       | Content/shape types (`card.types.ts` blocks model), settings, auth, files.                          |
| `src/lib/`         | IndexedDB (`db.ts`), sync serialize/media helpers, API helpers, formatting, search, etc.            |
| `src/services/`    | Topics, cards, sync (`sync.service.ts`, HTTP/WS clients), settings, backup, push.                   |
| `src/store/`       | Zustand: `topics-store`, `settings-store`, `screen-stack-store`.                                    |
| `src/contexts/`    | `auth-context.tsx`, `sync-context.tsx`.                                                             |
| `src/providers/`   | Backend ports (`auth` / `sync` / `settings`) when `VITE_API_URL` is set.                            |
| `src/hooks/`       | `use-online`, `use-is-mobile`, font size, tap, keyboard manager, etc.                               |
| `src/pages/`       | `root.tsx` (outlet + PWA/Pro prompts), `home.tsx`, OAuth callback, 404 / route error.               |
| `src/components/`  | `ui/` primitives, `screens/` overlays, `wrappers/` layout shells, domain components.                |
| `src/styles/`      | `index.css` — Tailwind v4 + `@theme` tokens; `#root` capped at 640px.                               |
| `apps/server/`     | Express API, Prisma, Redis, billing, auth, sync apply/pull.                                         |
| `packages/sync-*`  | Shared protocol and client transport.                                                               |
| `e2e/`, `testing/` | Playwright specs and shared Vitest/Playwright helpers.                                              |

_Confidence: High_

# Domain Model

- **Topic** — plain `interface` plus pure functions (`createTopic`, `setStartWeek`, `getNextUpdateDate`, `updateWeek`). Fields include `id`, `title`, `pivot`, `week`, `nextUpdateDate`, `updatedAt`, optional `deletedAt` / archive markers when mapping remote rows.
- **Card** — `class`. Constructor `new Card(data, topicId, level = 0)`. Fields: `id`, `topicId`, `level`, `data: CardData`, optional `reviewDate`, `updatedAt`.
- **Day** — `class` with scheduling behavior (`setLevelList(pivot)`).
- **Levels** — `0` draft, `1` everyday, ascending intervals through finished (`level-description.ts` / `day.model.ts`).
- **CardData** — block-based sides (`SideBlock[]`: text / code / image / audio). Legacy exclusive `type` + `content` shapes remain as `LegacyCardData` for import compatibility.

_Confidence: High_

# Data Flow

**Write path (local-first):**

1. UI or store action calls a **service**.
2. Service writes IndexedDB via `withTransaction`.
3. If signed in and `VITE_API_URL` is set, `enqueueSync` then `triggerSync()` (1500 ms debounce).
4. `syncAll`: **push** outbox, then **pull** deltas (unless realtime already covered the pull).

**Sync engine** — see [docs/sync.md](docs/sync.md). Summary: outbox coalesce by `` `${table}:${recordId}` ``, LWW on `updatedAt`, tombstones applied only when remote wins, `lastPulledAt` moves forward only, Pro device cap of 3.

**Reactive UI:** Zustand topics store subscribes to `subscribeSyncData()` and refreshes after pulls. Open topic/card screens fetch via services into local state and are not auto-refreshed by remote pulls.

**Auth-driven sync:** `AuthProvider` calls `setSyncUser` / `initialSync` on user change. `SyncProvider` syncs on online / visibility.

_Confidence: High_

# State Management

- **Zustand** — topics list (including search/archive), settings cache, screen-stack helpers.
- **React Context** — `AuthProvider` (session/user) and `SyncProvider` (status, `lastSyncedAt`, `isOnline`, `syncNow`).
- **Local state + URL search params** — overlay navigation and form state.

_Confidence: High_

# Persistence

- IndexedDB `spacedRepApp`, version **6**. Stores: `topics`, `cards`, `sync_queue`, `sync_meta`, user preference/learning/notification settings, `notification_reminders`, `subscription_cache`, `settings_outbox`, `media_cache`.
- `withTransaction` is the single IndexedDB entry point.
- Local deletes are hard; cloud deletes are soft tombstones; pulled tombstones that win LWW become local hard deletes.
- Cloud schema: `apps/server/prisma`.

_Confidence: High_

# Networking

- Express API when `VITE_API_URL` is set (`isBackendConfigured()`). Auth: email OTP, Google PKCE, passkeys. Entitlement gates sync and media.
- Data I/O through `SyncPort` / `SettingsPort`; auth through `AuthPort`.
- Connectivity: `useOnline` + SyncProvider visibility/online triggers.

_Confidence: High_

# UI Architecture

- **Routes:** `/` → `Root` → `HomePage`; `oauth/google/callback`; splat 404; `errorElement: RouteErrorPage`. `StartScreen` exists but is not mounted (commented out of the router).
- **No mobile gate.** `Root` renders the outlet plus PWA / Pro prompts. Desktop sees the same app in a centered 640px column (`#root` in `index.css`).
- **Search-param navigation** on home (`?create`, `?topicId`, `?settings`, `?auth`, nested card/level params). Back pops the last param (LIFO).
- **Component taxonomy:** `components/ui/`, `components/screens/` (including `SettingsScreen`), `components/wrappers/` (`Screen`, `Header`, …), top-level domain components.
- **Animation:** CSS transitions/keyframes only (no Framer Motion / `motion` dependency).
- **Styling:** Tailwind CSS v4 via `@tailwindcss/vite`, tokens in `@theme`.

_Confidence: High_

# Module Boundaries

Allowed dependency direction (top may depend on lower; never the reverse):

1. `models` / `types`
2. `lib`
3. `services` — only writers of persistence and cloud sync
4. `store` + `contexts`
5. `pages` / `components` / `hooks`

UI and store never touch IndexedDB or the network directly. Sync apply helpers must not re-enqueue. Import via `@/` barrels. Layer rules are also enforced by `pnpm lint` (oxlint + boundaries).

_Confidence: High_

# Public APIs

- `@/services` — topic/card CRUD, sync control (`setSyncUser`, `initialSync`, `syncNow`, `triggerSync`, `enqueueSync`, …), settings/backup/push as exported.
- `@/store` — `useTopicsStore` and related stores.
- `@/contexts` — `AuthProvider` / `useAuth`, `SyncProvider` / `useSync`.
- `@/lib` — `withTransaction`, `STORES`, sync-serialize helpers.
- `@/models` / `@/types` — domain entities and shapes.

Treat low-level `putLocal` / `deleteLocal*` / queue internals in `sync.service.ts` as private.

_Confidence: Medium_

# Common Patterns

- Barrel exports; service write → `enqueueSync` → `triggerSync`.
- Observer subscriptions for sync status and data-changed → store refresh.
- Search-param overlay stack; `Screen` wrapper gated by `isOpen`.
- Fine-grained Zustand selectors.
- LWW + tombstones; graceful local-only mode when backend unset.

_Confidence: High_

# Naming Conventions

- Files: kebab-case; models/services use dotted suffixes (`topic.model.ts`, `sync.service.ts`).
- Components: PascalCase, usually default export; screens re-exported with `Screen` suffix.
- Hooks / contexts: `useX`, `XProvider`.
- Sync row types: snake_case fields matching SQL; models camelCase.
- Constants: `UPPER_SNAKE_CASE`.

_Confidence: High_

# Coding Guidelines

- **Formatting:** Prettier — no semicolons, single quotes in TS/JS, double in JSX, no trailing commas (`.prettierrc`).
- **TypeScript:** strict; path alias `@/*` → `src/*` in the client.
- **Lint:** **oxlint** (`pnpm lint`) — layer boundaries, unused code, React hooks; see `AGENTS.md`.
- **Node / package manager:** Node **24.18** (`.node-version`), **pnpm 12.3**.

_Confidence: High_

# Error Handling

- Services: `try/catch`, log, usually rethrow; friendly mapping for duplicate titles.
- Sync: failures set `SyncState.status` to `error` / `offline` rather than throwing into UI.
- UI: `react-hot-toast` and inline form errors.
- Routing: splat 404, `RouteErrorPage`, app-level `ErrorBoundary`; `Screen` isolates overlay crashes.

_Confidence: High_

# Testing

- **Unit / integration:** Vitest 5 (projects: `client`, `server`, `server-integration`, `sync-protocol`, `sync-client`, `browser-extension`, `testing`). Colocated `*.test.ts(x)` / `*.integration.test.ts`.
- **E2E:** Playwright under `e2e/tests/` (smoke, study, auth OTP, two-device sync). CI runs **Chromium** only.
- Shared helpers: `testing/` (factories, OTP, Supertest agent, DB truncate). See [testing/README.md](testing/README.md).
- Coverage: V8 report uploaded in CI; **no** repo-wide percentage gate.
- Mutation: Stryker (`pnpm test:mutation`) for unit projects.

_Confidence: High_

# Important Architectural Decisions

1. Local-first IndexedDB; Express sync is optional and entitlement-gated.
2. Outbox + debounced push/pull; shared protocol packages.
3. Whole-record LWW on `updatedAt`; soft tombstones for cross-device deletes.
4. Observer bridge → Zustand refresh for the topics list.
5. Single-route, search-param screen stack.
6. Phone-column layout on all viewports (no desktop IA for beta).
7. Tailwind v4 `@theme` tokens as the styling source.

_Confidence: High_

# AI Working Guidelines

- Respect layering: persistence and network only through services / ports.
- Extend existing modules; keep write → enqueue → triggerSync.
- Preserve LWW / tombstone semantics; see [docs/sync.md](docs/sync.md).
- Open overlays via search params; do not add routes without strong need.
- Match Prettier + oxlint style; no new `!` / `as any` / disable comments to silence checks (`AGENTS.md`).
- Prefer existing wrappers, tokens, and helpers over new dependencies.

_Confidence: High_
