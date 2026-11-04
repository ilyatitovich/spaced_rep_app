## TC-1: Guest User Imports Cards — Added to Sync Queue

**Preconditions:**

- User is not authenticated (guest/offline mode) or authenticated but non-Pro

**Steps:**

1. As a guest user, create or import 800+ cards
2. Check the contents of the sync queue (outbox)

**Expected Result:**

- The sync queue contains create mutations for all imported cards and topics
- Mutations are not sent to the server while the user is non-Pro

**Priority:** Medium

## TC-2: Sync Queue — Idle Coalesce Vs in-Flight Ack

**Preconditions:**

- Backend sync is configured (queue writes are enabled)
- A card (or topic) id is known

### Idle Path (fixed)

**Steps:**

1. Enqueue an upsert for the record
2. Before any push starts, enqueue a delete for the same record
3. Inspect the sync queue; sign in a Pro account and observe network/server if desired

**Expected Result:**

- The pending upsert and delete coalesce to net-zero: the queue has no entry for that record
- Nothing is created on the server for that record

**Coverage:** Unit coalesce (`coalesceQueuedOperation`) and the client idle create-then-delete sync invariant.

### In-Flight Ack Path (under Test)

**Steps:**

1. Enqueue an upsert and start a push so that upsert is in flight
2. While the push is in flight, enqueue a delete (or edit) for the same record
3. The server acks the in-flight upsert
4. Inspect the sync queue, then allow sync to continue

**Expected Result:**

- The ack removes only the acked upsert opId
- The delete/edit that replaced it on the same record remains queued under a new opId and is pushed next
- The server ends with the delete (or newer edit), not a resurrected upsert-only state

**Priority:** High — an ack that keys only on `table:recordId` drops the follow-up op and can leave orphaned server rows
