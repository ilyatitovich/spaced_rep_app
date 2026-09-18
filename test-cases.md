## TC-1: Guest user imports cards — added to sync queue

**Preconditions:**

- User is not authenticated (guest/offline mode) or authenticated but non-Pro

**Steps:**

1. As a guest user, create or import 800+ cards
2. Check the contents of the sync queue (outbox)

**Expected Result:**

- The sync queue contains create mutations for all imported cards and topics
- Mutations are not sent to the server while the user is non-Pro

**Priority:** Medium

## TC-2: Guest user deletes cards before sign-in — sync queue cleanup

**Preconditions:**

- User is not authenticated (guest/offline mode)
- TC-1 has been executed: 800+ cards have been imported and are present in the sync queue

**Steps:**

1. Without signing in, delete all imported cards
2. Check the contents of the sync queue
3. Sign in a pro account
4. Check network requests and server state

**Expected Result:**

- After step 2: the sync queue contains no entries for the deleted cards/topics — create mutations for them have been removed/collapsed (net-zero), not left as orphaned entries
- After step 4: no requests are sent to the server for the deleted cards; no corresponding data appears on the server

**Actual Result (current bug):**
Cards/topics remain in the sync queue after deletion. Upon sign-in, mutations for the deleted cards are synced to the server, creating orphaned data.

**Priority:** High — leads to orphaned data on the server and unnecessary sync load on first sign-in
