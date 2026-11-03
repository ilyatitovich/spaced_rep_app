# Sync

Short reference for how multi-device sync works today. Whole-record **last-write-wins** (LWW) is intentional for the unpaid beta; field merge is a later product decision.

## Model

- **Local-first.** In-memory maps are the runtime lookup for topics and cards. IndexedDB (`spacedRepApp` v6) is the durable cache (hydrated on bootstrap). The Express API is optional (`VITE_API_URL`).
- **Outbox.** Mutating services update memory, then IndexedDB, then enqueue into `sync_queue` (key `` `${table}:${recordId}` `` so edits coalesce), then debounce-trigger `syncAll`.
- **Push then pull.** `syncAll` pushes up to 50 ops / ~700 KB, then pulls deltas since `lastPulledAt`. A WebSocket can deliver fanout; HTTP pull remains the fallback.
- **Watermark.** Server pull returns a `watermark`. The client advances `lastPulledAt` forward only (never rewinds). Callers keep requesting while `more` is true.
- **Tombstones.** Server soft-deletes (`deleted_at`). Clients hard-delete locally when a remote tombstone wins LWW. Physical purge waits until active devices have caught up (30-day active window).
- **LWW.** Apply remote if there is no local row or `remote.updatedAt > local.updatedAt`. An older delete does not beat a newer local write; a newer tombstone removes the row; a later upsert newer than the tombstone restores it.
- **Devices.** Pro allows **3** active devices (`PRO_DEVICE_LIMIT`). Registration past that returns `DEVICE_LIMIT`. Devices idle past 30 days drop out of the active set.
- **Auth / entitlement.** Sync and media require a signed-in entitled plan. Free local use does not need the API.

## What a conflict drops

When two devices edit the same topic or card, the **entire winning record** replaces the loser. Grades, text blocks, and media on the losing write are discarded — there is no per-field merge and no review log replay.

Duplicate topic titles on import/migrate are renamed on the server to `"{title} ({shortId})"`.

## Key files

| Area                | Path                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| Client engine       | `apps/client/src/services/sync.service.ts`                           |
| HTTP / WS           | `apps/client/src/services/sync-http.client.ts`, `sync-ws.manager.ts` |
| LWW helpers         | `apps/client/src/lib/sync-serialize.ts`                              |
| Server apply / pull | `apps/server/src/sync/sync.service.ts`                               |
| Tombstone purge     | `apps/server/src/sync/conflict.service.ts`                           |
| Protocol packages   | `packages/sync-protocol`, `packages/sync-client`                     |
