# ADR-1: Server-assigned sync sequence

- Status: Accepted (implemented)
- Date: 2026-11-04

## Context

Client `updatedAt` was both the LWW tiebreaker and the pull cursor / tombstone purge boundary. A late push with an old timestamp was invisible to HTTP pull; a future-dated row poisoned watermarks.

## Decision

Add a per-user monotonic `serverSeq`, assigned in the apply transaction. Pull cursor and tombstone purge use `serverSeq`. `updatedAt` remains for LWW only, with a future-skew clamp.

## Alternatives

- Server `now()` as cursor — ties and clock steps.
- Per-device vector clocks — overkill for a 3-device cap.
- Full re-pull on reconnect — correct but costly.

## Consequences

Protocol v4; clients keep forward-only watermark logic. One extra column and index, with migration backfill.
