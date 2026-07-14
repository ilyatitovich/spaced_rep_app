# Project Overview

**Spaced Repetition** is a mobile-first, offline-capable Progressive Web App (PWA) for memorizing information via spaced repetition. Users create **topics**, add flashcards (**cards**) with text / image / code content, and review them on a weekly, level-based schedule. The app is **local-first**: IndexedDB is the runtime source of truth, and an optional Supabase backend mirrors data per authenticated user for cross-device cloud sync. When Supabase is not configured (no env vars), the app runs fully local.

The project is published as a portfolio app (`package.json` name `spaced_rep_pwa`, author "Ilya Titov", MIT licensed).

_Confidence: High_

# Architecture

Layered, local-first client architecture with a clear one-directional dependency flow:

```
models / types      (domain entities + content shapes)
      ↓
lib/db.ts           (IndexedDB access: STORES, withTransaction)
lib/sync-serialize  (model ↔ Supabase row mapping, LWW comparator)
lib/supabase        (network client)
      ↓
services/           (CRUD + sync engine; the only writers of persistence)
      ↓
store/ (Zustand)    (reactive cache for the topics list)
contexts/           (Auth + Sync cross-cutting infra)
      ↓
pages / components  (UI; reads from store, contexts, or services)
```

Major building blocks:

- **Domain layer** (`src/models`, `src/types`) — entities and scheduling logic; no I/O.
- **Persistence layer** (`src/lib/db.ts`) — a single IndexedDB database `spacedRepApp` (v2) with four object stores.
- **Services layer** (`src/services`) — all CRUD, plus a sync engine (offline queue, debounced push/pull, observer emitters).
- **State layer** (`src/store`) — a single Zustand store for the topics list, bridged to sync via an observer.
- **Context layer** (`src/contexts`) — `AuthProvider` (Supabase session) and `SyncProvider` (sync status + connectivity).
- **UI layer** (`src/pages`, `src/components`) — a single React Router v7 route where navigation is driven by URL search params.

_Confidence: High_

# Directory Structure

| Path | Purpose |
|------|---------|
| `src/models/` | Domain entities: `topic.model.ts`, `card.model.ts` (`Card` class), `day.model.ts` (`Day` class + review-level scheduling). |
| `src/types/` | Content/shape types (`card.types.ts`): `CardData`, `SideContent`, `CodeBlock`, image records, editor handles. |
| `src/lib/` | Framework-agnostic utilities: `db.ts` (IndexedDB), `supabase.ts`, `sync-serialize.ts`, plus many small helpers (formatting, onboarding, search, image, auth-errors, etc.). All re-exported from `src/lib/index.ts`. |
| `src/services/` | `topic.services.ts`, `card.services.ts`, `sync.service.ts`. Persistence + cloud sync. |
| `src/store/` | Zustand store (`topics-store.ts`). |
| `src/contexts/` | `auth-context.tsx`, `sync-context.tsx`. |
| `src/hooks/` | Custom hooks: `use-online`, `use-is-mobile`, `use-font-size`, `use-tap`. |
| `src/pages/` | Route components: `root.tsx` (mobile gate), `home.tsx`, `not-found.tsx`. |
| `src/components/` | UI, split into `ui/` (primitives), `screens/` (full-screen overlays), `wrappers/` (layout shells), and top-level domain components. |
| `src/styles/` | `index.css` — Tailwind v4 import + `@theme` design tokens. |
| `src/__tests__/` | Jest tests, mirroring source paths (e.g. `__tests__/lib/...`). |
| `supabase/migrations/` | SQL schema for the cloud mirror (`001_cloud_sync.sql`). |
| `src/router.tsx`, `src/app.tsx`, `src/main.tsx` | Router definition, provider composition, and bootstrap. |

_Confidence: High_

# Domain Model

- **Topic** (`topic.model.ts`) — currently a **plain `interface`** plus pure functions (`createTopic`, `setStartWeek`, `getNextUpdateDate`, `updateWeek`). Fields: `id`, `title` (unique), `pivot` (creation timestamp anchoring the schedule), `week: Array<Day | null>` (7 slots; past days in the current week are `null`), `nextUpdateDate` (next Sunday 00:00 epoch ms, when the week rolls over), `updatedAt` (LWW timestamp), `deletedAt` (soft-delete marker used only when mapping remote rows).
- **Card** (`card.model.ts`) — a **`class`**. Constructor `new Card(data, topicId, level = 0)` assigns `crypto.randomUUID()` and `updatedAt`. Fields: `id`, `topicId`, `level`, `data: CardData`, optional `reviewDate`, `updatedAt`.
- **Day** (`day.model.ts`) — a **`class`** with scheduling behavior. Holds `date`, `todayLevels: number[]`, `isDone`. `setLevelList(pivot)` computes which review levels are due on that day based on day-offset divisibility.
- **Levels** — `0` = draft, `1` = everyday, ascending intervals up to `7` (~every 64 days), `8` = finished (per `day.model.ts` comments and `level-description.ts`).
- **CardData** (`types/card.types.ts`) — `{ front: CardSideData; back: CardSideData }`, where each side has `side`, `type` (`'text' | 'image' | 'code'`), and `content` (`string | Blob | CodeBlock | ImageDBRecord`).

Note the inconsistency: `Card` and `Day` are classes, `Topic` is an interface. See _Questions / Uncertain Areas_.

_Confidence: High_

# Data Flow

**Write path (local-first):**

1. UI (or a store action) calls a **service** (`createTopic`, `updateCard`, `deleteTopic`, ...).
2. The service writes IndexedDB via `withTransaction`.
3. If a user is signed in **and** Supabase is configured, the service calls `enqueueSync(table, recordId, operation)` then `triggerSync()`.
4. `triggerSync()` debounces (1500 ms) and runs `syncAll(userId)`: **push** the queue, then **pull** deltas.

**Sync engine (`sync.service.ts`):**

- **Push** — process `sync_queue` FIFO. `upsert` reads the local record, serializes via `topicToRow`/`cardToRow`, and calls Supabase `.upsert`. `delete` issues a soft delete (`deleted_at` + `updated_at`). Queue items are removed on success.
- **Pull** — query rows where `user_id = userId AND updated_at > lastPulledAt` (`lastPulledAt` stored in `sync_meta`). For each row: if `deleted_at` is set, **hard-delete locally**; otherwise apply if `shouldApplyRemote(local.updatedAt, remoteMs)` (last-write-wins). Advance `lastPulledAt`. If any local mutation occurred, call `emitSyncData()`.

**Reactive UI update:** the Zustand store subscribes to `subscribeSyncData()`; when a pull mutates the local DB, the store calls `refreshTopics()` (re-reads IndexedDB) and subscribed components re-render.

**Auth-driven sync:** `AuthProvider` calls `setSyncUser(userId)` and `initialSync(userId)` on user change; `initialSync` runs a one-time `migrateLocalToCloud()` (guarded by `migratedUserId` in `sync_meta`) then `syncAll`. `SyncProvider` calls `syncNow()` when coming online or when the tab becomes visible.

_Confidence: High_

# State Management

Three distinct state homes, used consistently:

- **Zustand (`useTopicsStore`)** — the **topics list** only. Holds `topics` (filtered view), `allTopics` (full set mirrored from DB), `searchQuery`, `isLoading`, and `currentTopic`. Actions: `loadTopics`, `refreshTopics` (silent reload, no spinner), `addTopic`, `updateTopic`, `deleteTopics`, `searchTopics`, `setCurrentTopic`. A module-level `subscribeSyncData` bridge keeps it in sync with remote pulls. UI consumes it via fine-grained selectors (`useTopicsStore(s => s.topics)`).
- **React Context** — cross-cutting infra only: `AuthProvider` (session/user) and `SyncProvider` (sync status, `lastSyncedAt`, `isOnline`, `syncNow`).
- **Local component state + URL search params** — per-screen UI state (selection mode, form fields, local modals) and navigation stack.

Individual topic/card screens (e.g. `topic.tsx`) fetch directly via services into local `useState`; they are **not** automatically refreshed by remote pulls (only the topics list is).

_Confidence: High_

# Persistence

- **IndexedDB** database `spacedRepApp`, version `2` (`src/lib/db.ts`). Object stores (`STORES`):
  - `topics` — keyPath `id`, unique index on `title`.
  - `cards` — keyPath `id`, non-unique index on `topicId`.
  - `sync_queue` — keyPath `id`; queue items `{ id, table, recordId, operation, createdAt }`. Item id is `` `${table}:${recordId}` `` so re-enqueuing a record coalesces.
  - `sync_meta` — keyPath `key`; used keys: `lastPulledAt`, `migratedUserId`.
- **`withTransaction(storeNames, mode, callback)`** is the single entry point for all IndexedDB access; it opens the DB, runs the callback with a `stores` map, resolves on `oncomplete`, and aborts on error.
- **Deletes are asymmetric:** local deletes are **hard**; cloud pushes are **soft** (`deleted_at` tombstone); pulled tombstones become local hard deletes. This lets tombstones propagate across devices.
- **Cloud mirror** (`supabase/migrations/001_cloud_sync.sql`): `public.topics` and `public.cards` with `user_id` FK to `auth.users`, `updated_at`/`deleted_at`, JSONB `week`/`data`, RLS `FOR ALL` policies gated by `auth.uid() = user_id`, and a unique `(user_id, title) WHERE deleted_at IS NULL` index mirroring the local unique `title` index.

_Confidence: High_

# Networking

- **Supabase** is the only external service. The client is created once in `src/lib/supabase.ts` using `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. If either is missing, `isSupabaseConfigured` is `false` and the client falls back to harmless placeholder credentials so construction never throws; all real network calls are gated on `isSupabaseConfigured` (and a current user).
- All Supabase reads/writes are confined to `sync.service.ts` (data) and `auth-context.tsx` (auth: OAuth, email OTP, session). No other module talks to the network directly.
- **Connectivity detection**: `useOnline` (via `useSyncExternalStore` on browser online/offline events) and `useOnlineVerified` (adds a periodic HEAD ping to `/favicon.ico`). `SyncProvider` uses `useOnlineVerified`.

_Confidence: High_

# UI Architecture

- **Single route, search-param navigation.** React Router v7 defines one tree: `/` → `Root` → index route. `Root` gates on `useIsMobile()` (≤ 640px): desktop sees `DesktopMessage`, mobile sees the app. Onboarding is gated by `localStorage` (`isOnboardingComplete`), not a route — first-time users see `StartScreen`.
- **Overlay screens** are opened by setting URL search params (e.g. `?create=true`, `?topicId=<uuid>`, `?account=true`, and nested `?addCard`, `?levelId`, `?cardId`, `?test`, `?topicSettings`). Screens render as siblings gated by an `isOpen` prop derived from params. **Back navigation pops the last param** via `removeLastSearchParam` (LIFO stack semantics).
- **Component taxonomy:**
  - `components/ui/` — primitives (`Button`, `Search`, `Spinner`, `TopicItem`, `ConfirmDeleteModal`, selection-mode chrome, icons).
  - `components/screens/` — full-screen views (`TopicScreen`, `CreateTopicScreen`, `AccountScreen`, `AddCardScreen`, `LevelScreen`, `TestScreen`, `StartScreen`, ...).
  - `components/wrappers/` — layout shells: `Screen` (slide-in overlay via CSS transform transition; supports `isVertical`, defers children until first open, fires `onClose` after transition), `Header` (3-slot app bar with centered middle), `CardContainer`.
  - `components/*.tsx` — top-level domain components (`Card` flip, `Week` strip, `Side`, auth forms, editors).
- **Animation** is dual-system: `motion/react` for lists (staggered `variants` + `AnimatePresence`), modals, and micro-interactions; **CSS** transitions/keyframes for screen slides and card flip/move sequences.
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite`, with design tokens defined in `@theme` in `src/styles/index.css` (`--color-background`, `--color-purple`, `--color-lvl-1..7`, `--font-card`). Purple (`purple-600`) is the accent. Mobile viewport units (`dvh`) are used pervasively.

_Confidence: High_

# Module Boundaries

Allowed dependency direction (top may depend on lower; never the reverse):

1. `models` / `types` — depend on nothing app-specific.
2. `lib` (`db`, `sync-serialize`, `supabase`, helpers) — may depend on `models`/`types`.
3. `services` — the **only** modules that write persistence and talk to Supabase for data; depend on `lib` + `models`.
4. `store` + `contexts` — depend on `services` (+ `lib`/`hooks`); own reactive state.
5. `pages` / `components` / `hooks` — depend on `store`, `contexts`, `services`, `lib`.

Conventions consistently observed:

- UI and store **never** touch IndexedDB or Supabase directly — always through services.
- `withTransaction` is the sole IndexedDB access mechanism.
- The sync engine writes to IndexedDB via internal `putLocal`/`deleteLocal*` helpers that **never re-enqueue**, preventing sync loops.
- Cross-module communication uses **barrels** (`@/components`, `@/services`, `@/lib`, `@/contexts`, `@/hooks`, `@/models`, `@/store`, `@/pages`) and the observer pattern (`subscribeSync`, `subscribeSyncData`).

_Confidence: High_

# Public APIs

Stable interfaces intended for consumption by other layers (import via the barrel, not the file):

- `@/services` — `createTopic`, `getAllTopics`, `getTopicById`, `updateTopic(s)`, `deleteTopic`, `exportTopic`; `createCard`, `updateCard`, `deleteCardById`, `deleteCardsBulk`, `importCards`; sync control: `setSyncUser`, `initialSync`, `syncNow`, `triggerSync`, `enqueueSync`, `getSyncState`, `subscribeSync`, `subscribeSyncData`, plus `SyncState`/`SyncStatus` types.
- `@/store` — `useTopicsStore`.
- `@/contexts` — `AuthProvider`/`useAuth`, `SyncProvider`/`useSync`.
- `@/lib` — `withTransaction`, `STORES`, `supabase`, `isSupabaseConfigured`, `sync-serialize` mappers, and utility helpers.
- `@/models` — entities + factory/scheduling functions. `@/types` — content/shape types.

**Do not import directly** (treat as internal): the low-level `putLocal`/`deleteLocal*`/`getQueue` helpers in `sync.service.ts` (not exported), and deep file paths that a barrel already re-exports.

_Confidence: Medium_ (the "public vs internal" distinction is inferred from export surface and usage, not explicitly documented.)

# Common Patterns

- **Barrel exports** (`index.ts`) per folder; consumers import from `@/<folder>`.
- **Service = write DB → `enqueueSync` → `triggerSync`** for every mutating operation.
- **Observer/subscription** for decoupling layers (`subscribeSync` for status, `subscribeSyncData` for data-changed → store refresh).
- **Search-param navigation stack** with LIFO back button.
- **`Screen` wrapper** for slide-in overlays gated by `isOpen`.
- **Fine-grained Zustand selectors** rather than consuming the whole store.
- **Last-write-wins** conflict resolution keyed on `updatedAt`; soft-delete tombstones for cross-device deletes.
- **Graceful degradation**: every network/sync path is guarded by `isSupabaseConfigured` and a current user, enabling local-only mode.

_Confidence: High_

# Naming Conventions

- **Files/folders:** kebab-case (`create-topic.tsx`, `topic-item.tsx`, `use-online.ts`). Model/service files use dotted suffixes (`topic.model.ts`, `card.services.ts`, `sync.service.ts`).
- **Components:** PascalCase, almost always `export default function`. Screen files often export an unsuffixed name internally (`CreateTopic`) but are re-exported from the screens barrel with a `Screen` suffix (`CreateTopicScreen`).
- **Hooks:** `useX` camelCase, **named** exports.
- **Contexts:** `XProvider` + `useX`, named exports.
- **Services/utilities/store:** named exports; store hook is `use<Entity>Store`.
- **Types/interfaces:** PascalCase; Supabase row types use snake_case fields (`TopicRow`, `CardRow`) matching SQL columns, while models use camelCase.
- **Constants:** `UPPER_SNAKE_CASE` (`STORES`, `TRIGGER_DEBOUNCE_MS`, `TITLE_MAX_LENGTH`).

_Confidence: High_

# Coding Guidelines

Inferred and enforced by tooling (`.prettierrc`, `eslint.config.js`, `tsconfig.json`):

- **Formatting:** no semicolons, single quotes in TS/JS, double quotes in JSX, no trailing commas, arrow parens avoided, 2-space indent, print width 80, LF line endings, final newline.
- **TypeScript:** full `strict` mode plus `noUnusedLocals`/`noUnusedParameters`/`noImplicitAny`/`strictNullChecks`/`noFallthroughCasesInSwitch`. `@/*` path alias → `src/*`.
- **ESLint (flat config):** active plugins are `perfectionist` (enforced import sorting: alphabetical, newlines between groups, ordered side-effect → style → external/type → internal → object), `@typescript-eslint`, `react`, `react-hooks`, `jsx-a11y`. Unused vars are errors unless prefixed `_`. `explicit-function-return-type` is off; `react-in-jsx-scope`/`prop-types` are off. `sonarjs` is registered but its ruleset is commented out; `react-refresh` is a devDependency but not wired into the config.
- **Style habits observed:** default exports for components; async service functions wrapped in `try/catch`; imperative IndexedDB calls promisified; explicit return types on many functions even though not required.

_Confidence: High_

# Error Handling

- **Services** wrap operations in `try/catch`, `console.error(...)`, and usually **rethrow** so callers can react. `createTopic` maps IndexedDB `ConstraintError` (duplicate title) to a friendly `Error` message.
- **Sync** (`syncAll`) catches failures, logs, and sets `SyncState.status = 'error'` (or `'offline'` when `navigator.onLine` is false) instead of throwing to the UI. Sync operations are no-ops when unconfigured/offline/logged-out.
- **Store actions** catch errors, log, and reset `isLoading`; they generally do not surface errors to components beyond state.
- **UI** surfaces user-facing errors via `react-hot-toast` (e.g. `toast.success`/`toast.error` in create/import flows) and inline form error state.
- **Routing** uses `errorElement: <NotFoundPage />` on the root route as the error boundary/404.

_Confidence: High_

# Testing

- **Runner:** Jest 30 with `ts-jest` (ESM), `jsdom` environment. Config in `jest.config.cjs`; `setupTests.cjs` loads `@testing-library/jest-dom` and polyfills `crypto.randomUUID` for jsdom.
- **Module mapping:** `^@/(.*)$` → `src/$1`; CSS imports stubbed via `identity-obj-proxy`.
- **Location/convention:** tests live under `src/__tests__/`, mirroring source structure, named `*.test.ts(x)`. `@testing-library/react` is available for component tests, but current coverage is limited to pure-logic units (`remove-last-search-param`, `sync-serialize`). No coverage thresholds are configured; `pnpm test` runs with `--coverage`.
- **CI:** `.github/workflows/tests.yml` runs on push to `main` and all PRs; it installs via the composite `init-node` action (pnpm 10.26, Node 24.12) and runs `pnpm test` only. Lint/build/format are **not** part of CI.

_Confidence: High_

# Important Architectural Decisions

1. **Local-first with IndexedDB as source of truth**; Supabase is an optional per-user mirror. The app is fully functional offline / unconfigured.
2. **Offline sync queue + debounced push/pull** decouples user actions from network; a single `sync.service.ts` owns all data networking.
3. **Last-write-wins conflict resolution** on `updatedAt`, with **soft-delete tombstones** propagated from cloud and applied as local hard deletes.
4. **Observer bridge (`subscribeSyncData`) → Zustand refresh** makes remote pulls reactively update the UI without coupling sync to React.
5. **Single-route, search-param-driven navigation** emulates a native mobile screen stack (with LIFO back) instead of nested URL routes.
6. **Strict layering** enforced by convention: UI/store never touch persistence or network directly.
7. **Mobile-only** experience gated at `Root`; onboarding via localStorage.
8. **Tailwind v4 `@theme` tokens** as the single styling source, no separate Tailwind/PostCSS config files.

_Confidence: High_

# AI Working Guidelines

- **Respect the layering.** Never read/write IndexedDB or Supabase from components, hooks, contexts, or the store — go through `src/services`. Use `withTransaction` for any new IndexedDB access.
- **Extend existing modules** rather than adding parallel ones. New topic/card operations belong in the existing service files; new list state belongs in `useTopicsStore`.
- **Keep the write pattern:** any mutating service must write the DB, then `enqueueSync(...)`, then `triggerSync()`, and must guard on `isSupabaseConfigured` + current user.
- **Preserve reactivity:** if a new remote-applied mutation should update the UI, ensure the pull path triggers `emitSyncData()` and that the relevant store refreshes (currently only the topics list listens; topic/card screens fetch on their own).
- **Follow navigation conventions:** open screens by setting search params and gate with `isOpen`; use `removeLastSearchParam`/`BackButton` for back. Do not introduce new URL routes without strong justification.
- **Use barrels and the `@/` alias** for imports; add new exports to the appropriate `index.ts`. Import screens by their `Screen`-suffixed barrel name.
- **Match style exactly:** no semicolons, single quotes (double in JSX), no trailing commas, 2-space indent; keep imports sorted per `perfectionist`. Prefix intentionally-unused identifiers with `_`.
- **Do not add dependencies** without clear need; reuse `motion/react`, `lucide-react`, `react-hot-toast`, Tailwind tokens, and existing hooks/utilities.
- **Inspect neighboring code first**; reuse `sync-serialize` mappers, `Screen`/`Header` wrappers, `Button`, and existing modal/animation patterns instead of reinventing them.
- **Keep conflict/delete semantics** (LWW via `updatedAt`, soft-delete tombstones) intact when touching sync.

_Confidence: High_

# Questions / Uncertain Areas

- **`Topic` model shape is inconsistent with tests.** `topic.model.ts` defines `Topic` as an **interface** with factory functions, but `src/__tests__/lib/sync-serialize.test.ts` uses `new Topic('Spanish')` (and `new Card(...)`). `tsc --noEmit` currently reports errors in that test (`'Topic' only refers to a type, but is being used as a value`). It is unclear whether `Topic` was recently refactored from a class to an interface (leaving the test stale) or the test anticipates a future class. Verify the intended representation. _(Low)_
- **`deleteTopics` filter logic** in `topics-store.ts` uses an inverted-looking ternary (`!Array.isArray(ids) ? ids.includes(...) : !ids.includes(...)`). Whether the string-id branch behaves as intended should be verified. _(Low)_
- **Lint/build not in CI.** Only `pnpm test` runs in CI; ESLint and `tsc`/`vite build` are not gated. It's unclear if this is intentional. _(Medium)_
- **`sonarjs` and `react-refresh`** are installed but effectively inactive (rules commented / not wired). Intent unknown. _(Medium)_
- **Card-level reactivity:** topic/card detail screens do not subscribe to `subscribeSyncData`, so remote changes to an open card/level view won't auto-refresh. Unclear whether this is a deliberate scope limit. _(Medium)_
- **`STAGING` CI env var** is set in the workflow but not referenced in source. Purpose unknown. _(Low)_
- **Passkey / additional auth methods** and "poor connection" ping handling are mentioned in `notes.txt` as intentions but only partially implemented (OAuth + email OTP exist; connectivity ping exists via `useOnlineVerified`). Roadmap vs. shipped state is ambiguous. _(Low)_
- **PWA service-worker registration** is delegated entirely to `vite-plugin-pwa` (`registerType: 'autoUpdate'`); there is no explicit `registerSW` in source, so update UX relies on plugin defaults. _(Medium)_
