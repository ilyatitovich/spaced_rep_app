# Sync

Short reference for how multi-device sync works today. Whole-record **last-write-wins** (LWW) is intentional for the unpaid beta; field merge is a later product decision.

## Model

- **Local-first.** In-memory maps are the runtime lookup for topics and cards. IndexedDB (`spacedRepApp` v6) is the durable cache (hydrated on bootstrap). The Express API is optional (`VITE_API_URL`).
- **Outbox.** Mutating services update memory, then IndexedDB, then enqueue into `sync_queue` (key `` `${table}:${recordId}` `` so edits coalesce), then debounce-trigger `syncAll`.
- **Push then pull.** `syncAll` pushes up to 50 ops / ~700 KB, then pulls deltas since `lastPulledAt`. A WebSocket can deliver fanout; HTTP pull remains the fallback.
- **Cursor (`serverSeq`).** Every synced row carries a server-assigned, per-user, monotonic `serverSeq` (ADR-1). Pull returns a `watermark` that is the highest `serverSeq` delivered, as an opaque decimal string; protocol v4. The client advances `lastPulledAt` forward only, comparing numerically (never rewinds), and keeps requesting while `more` is true. A pre-v4 ISO cursor parses as "from the start", which is a safe idempotent full re-pull. WebSocket fanout deltas carry an empty watermark and never move the cursor. `updatedAt` is no longer a cursor; it only decides LWW.
- **Why a counter on the user row.** The sequence comes from `users.sync_seq`, locked (`FOR NO KEY UPDATE`) as the first statement of every apply transaction. That serializes a user's applies, so commit order equals sequence order and a pulling client can never skip a lower sequence that commits late. A late edit with an old `updatedAt` gets a fresh `serverSeq`, so peers already past that timestamp still receive it. A push that loses LWW writes nothing and takes no sequence.
- **Future-skew clamp.** `updatedAt` (and `deletedAt`) from a client more than 5 minutes ahead of the server clock are clamped to server time + 5 minutes before apply, so one fast clock cannot win every later conflict. This is an interim guard until LWW stops trusting client clocks.
- **Tombstones.** Server soft-deletes (`deleted_at`). Clients hard-delete locally when a remote tombstone wins LWW. Physical purge removes tombstones with `serverSeq` at or below the lowest `lastPulledSeq` across active devices (30-day active window), so a late delete is kept until every device has seen it. A device confirms a sequence by sending it as its next `since` (or WebSocket `hello` cursor), not by receiving it in a response: it may still hold a queued edit for the deleted row, and a purge before it applies the delta would let that edit resurrect the row.
- **LWW.** Apply remote if there is no local row or `remote.updatedAt > local.updatedAt`. An older delete does not beat a newer local write; a newer tombstone removes the row; a later upsert newer than the tombstone restores it.
- **Devices.** Pro allows **3** active devices (`PRO_DEVICE_LIMIT`). Registration past that returns `DEVICE_LIMIT`. Devices idle past 30 days drop out of the active set.
- **Auth / entitlement.** Sync and media require a signed-in entitled plan. Free local use does not need the API.

## What a conflict drops

When two devices edit the same topic or card, the **entire winning record** replaces the loser. Grades, text blocks, and media on the losing write are discarded — there is no per-field merge and no review log replay.

Duplicate topic titles on import/migrate are renamed on the server to `"{title} ({shortId})"`.

## Sign-out and account switch

Sign-out wipes this device's topics, cards, outbox and pull cursor (the device id survives), so it never loses or leaks data silently:

1. `signOut()` first calls `flushPendingChanges()`, which pushes the outbox (bounded to 10 s). If anything is still queued (offline, not Pro, rejected, timed out) it throws `UnsyncedChangesError`; the UI asks the user and retries with `{ discardUnsynced: true }`.
2. After logout, `setSyncUser(null)` disconnects the socket, stops new runs and wipes only after the in-flight run ends. Wiping under a running pull would let it re-seed the store with that account's rows, which the next sign-in would adopt as guest data.
3. Switching directly from account A to B (no sign-out) cannot flush, because A's credentials are gone. A's unsynced edits are dropped, never uploaded as B's. `initialSync(B)` waits for that wipe instead of joining A's run.
4. `migratedUserId` stays a second line of defence: if a wipe failed, rows owned by another account are cleared on the next sign-in rather than adopted.

## Key files

| Area                | Path                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| Client engine       | `apps/client/src/services/sync.service.ts`                           |
| HTTP / WS           | `apps/client/src/services/sync-http.client.ts`, `sync-ws.manager.ts` |
| LWW helpers         | `apps/client/src/lib/sync-serialize.ts`                              |
| Server apply / pull | `apps/server/src/sync/sync.service.ts`                               |
| Sequence + clamp    | `apps/server/src/sync/seq.ts`                                        |
| Cursor helpers      | `packages/sync-protocol/src/cursor.ts`                               |
| Tombstone purge     | `apps/server/src/sync/conflict.service.ts`                           |
| Protocol packages   | `packages/sync-protocol`, `packages/sync-client`                     |
