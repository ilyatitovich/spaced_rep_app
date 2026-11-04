# Sync

Short reference for how multi-device sync works today. Whole-record **last-write-wins** (LWW) is intentional for the unpaid beta; field merge is a later product decision.

## Model

- **Local-first.** In-memory maps are the runtime lookup for topics and cards. IndexedDB (`spacedRepApp` v6) is the durable cache (hydrated on bootstrap). The Express API is optional (`VITE_API_URL`).
- **Outbox.** Mutating services update memory, then write the row **and** its `sync_queue` op in one IndexedDB transaction (key `` `${table}:${recordId}` `` so edits coalesce), then debounce-trigger `syncAll`. A row without its op, or the reverse, cannot exist.
- **Push then pull.** `syncAll` pushes up to 50 ops / ~700 KB, then pulls deltas since `lastPulledAt`. A WebSocket can deliver fanout; HTTP pull remains the fallback.
- **Cursor (`serverSeq`).** Every synced row carries a server-assigned, per-user, monotonic `serverSeq` (ADR-1). Pull returns a `watermark` that is the highest `serverSeq` delivered, as an opaque decimal string; protocol v4. The client advances `lastPulledAt` forward only, comparing numerically (never rewinds), and keeps requesting while `more` is true. A pre-v4 ISO cursor parses as "from the start", which is a safe idempotent full re-pull. WebSocket fanout deltas carry an empty watermark and never move the cursor. `updatedAt` is no longer a cursor; it only decides LWW.
- **Why a counter on the user row.** The sequence comes from `users.sync_seq`, locked (`FOR NO KEY UPDATE`) as the first statement of every apply transaction. That serializes a user's applies, so commit order equals sequence order and a pulling client can never skip a lower sequence that commits late. A late edit with an old `updatedAt` gets a fresh `serverSeq`, so peers already past that timestamp still receive it. A push that loses LWW writes nothing and takes no sequence.
- **Future-skew clamp.** `updatedAt` (and `deletedAt`) from a client more than 5 minutes ahead of the server clock are clamped to server time + 5 minutes before apply, so one fast clock cannot win every later conflict. This is an interim guard until LWW stops trusting client clocks.
- **Tombstones.** Server soft-deletes (`deleted_at`). Clients hard-delete locally when a remote tombstone wins LWW. Physical purge removes tombstones with `serverSeq` at or below the lowest `lastPulledSeq` across active devices (30-day active window), so a late delete is kept until every device has seen it. A device confirms a sequence by sending it as its next `since` (or WebSocket `hello` cursor), not by receiving it in a response: it may still hold a queued edit for the deleted row, and a purge before it applies the delta would let that edit resurrect the row.
- **LWW.** Apply remote if there is no local row or `remote.updatedAt > local.updatedAt`. An older delete does not beat a newer local write; a newer tombstone removes the row; a later upsert newer than the tombstone restores it.
- **Devices.** Pro allows **3** active devices (`PRO_DEVICE_LIMIT`). Registration past that returns `DEVICE_LIMIT`. Devices idle past 30 days drop out of the active set.
- **Auth / entitlement.** Sync and media require a signed-in entitled plan. Free local use does not need the API.

## Engine Guarantees (client)

- **One run at a time.** HTTP sync, the post-connect flush and WebSocket recovery all go through one single-flight mutex; a request that arrives mid-run makes it loop once more. Incoming deltas (HTTP, bootstrap, WebSocket fanout) apply strictly in order, and the cursor moves forward in a single compare-and-write transaction.
- **Multi-tab.** Runs also take a Web Lock (`spaced-rep-sync`), so two tabs never push the same outbox or apply the same delta; the second waits, then finds the work done. Decisions to push or overwrite read the durable IndexedDB row, never a tab's in-memory copy (which another tab may have outdated). A tab that applies a pull announces it on a `BroadcastChannel` and other tabs reload memory from IndexedDB.
- **Poison records.** A pulled record the client can never apply (undecodable, unreadable card data) is quarantined into `failedOps` with code `POISON_RECORD`, once per record; the rest of the delta applies and the cursor advances. Environmental failures (quota, media download) still fail the delta and retry, because skipping them would lose data.
- **Transient failures.** Network errors, 5xx, 408 and 429 schedule a retry with exponential backoff (2 s, 4 s, ... capped at 5 min). Other errors surface and wait for the user or the next trigger. Offline runs wait for the browser's `online` event.
- **401.** A 401 on an HTTP sync or media request refreshes the session once (single-flight) and replays the request. A refresh the server rejects signs the user out; a network failure keeps the session.

## Request Validation (server)

Push, pull and bootstrap are validated before any work happens; failures are 4xx, never 500.

- **Shape.** Client ids (`opId`, `recordId`, mutation `deviceId`, record `id`, card `topicId`, envelope `deviceId`) must be UUIDs, because they land in Postgres `uuid` columns. The check lives on request schemas only: records the server sends back stay lenient (a fanout card tombstone has an empty `topicId`). A bad envelope is `400 VALIDATION_ERROR` and applies nothing.
- **Limits.** At most `MAX_PUSH_MUTATIONS` (100) per push, `since` / `lastPulledAt` at most `MAX_CURSOR_LENGTH` (64) characters, JSON bodies at most 1 MB. A cursor that does not fit a bigint reads as "from the start" rather than overflowing the query.
- **Body-parser errors.** Oversized body is `413 PAYLOAD_TOO_LARGE`, malformed JSON is `400 INVALID_JSON`, an unsupported encoding is `415`. The parser message and body are never echoed.
- **Malformed ops.** What a schema cannot express (unparseable `dataJson` / `weekJson`, payload id differing from `recordId`, fractional or out-of-range numbers, NUL characters, invalid timestamps) is rejected per op as `VALIDATION_ERROR` with `retryable: false`, before the batch's media checks, so one bad card cannot fail the cards sent with it.
- **Retryable vs permanent.** A 4xx apply failure (for example `FORBIDDEN`, a topic owned by another user) is permanent. A card whose topic is not on the server yet is `TOPIC_NOT_SYNCED` and stays retryable, because the topic's own op may still be queued. Unexpected errors stay `APPLY_FAILED`, retryable.

## What a Conflict Drops

When two devices edit the same topic or card, the **entire winning record** replaces the loser. Grades, text blocks, and media on the losing write are discarded — there is no per-field merge and no review log replay.

The Sunday week rebuild (`updateWeek`, run from `getAllTopics`) is the same kind of whole-topic write: if two devices roll the week, or one rolls while another finishes today's study, the later `updatedAt` wins and can overwrite the other's `isDone` flags. Accepted for the beta; a review log (ADR-2) is the fix if users report it.

Duplicate topic titles on import/migrate are renamed on the server to `"{title} ({shortId})"`.

## Sign-Out and Account Switch

Sign-out wipes this device's topics, cards, outbox and pull cursor (the device id survives), so it never loses or leaks data silently:

1. `signOut()` first calls `flushPendingChanges()`, which pushes the outbox (bounded to 10 s). If anything is still queued (offline, not Pro, rejected, timed out) it throws `UnsyncedChangesError`; the UI asks the user and retries with `{ discardUnsynced: true }`.
2. After logout, `setSyncUser(null)` disconnects the socket, stops new runs and wipes only after the in-flight run ends. Wiping under a running pull would let it re-seed the store with that account's rows, which the next sign-in would adopt as guest data.
3. Switching directly from account A to B (no sign-out) cannot flush, because A's credentials are gone. A's unsynced edits are dropped, never uploaded as B's. `initialSync(B)` waits for that wipe instead of joining A's run.
4. `migratedUserId` stays a second line of defence: if a wipe failed, rows owned by another account are cleared on the next sign-in rather than adopted.

## Key Files

| Area                | Path                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| Client engine       | `apps/client/src/services/sync.service.ts` (lifecycle, retry)        |
| Client engine parts | `sync-queue.ts`, `sync-push.ts`, `sync-pull.ts`, `sync-local.ts`     |
|                     | `sync-meta.ts`, `sync-state.ts`, `sync-records.ts`, `sync-tabs.ts`   |
| HTTP / WS           | `apps/client/src/services/sync-http.client.ts`, `sync-ws.manager.ts` |
| LWW helpers         | `apps/client/src/lib/sync-serialize.ts`                              |
| Server apply / pull | `apps/server/src/sync/sync.service.ts`                               |
| Sequence + clamp    | `apps/server/src/sync/seq.ts`                                        |
| Cursor helpers      | `packages/sync-protocol/src/cursor.ts`                               |
| Op validation       | `apps/server/src/sync/mutation-validation.ts`                        |
| Tombstone purge     | `apps/server/src/sync/conflict.service.ts`                           |
| Protocol packages   | `packages/sync-protocol`, `packages/sync-client`                     |
