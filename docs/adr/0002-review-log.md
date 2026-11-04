# ADR-2: Review log versus whole-record LWW

- Status: Accepted (deferred)
- Date: 2026-11-04

## Context

Concurrent grading on two devices loses one side under whole-record last-write-wins. The same applies to Sunday week rebuilds that overwrite `isDone` flags. Documented in [docs/sync.md](../sync.md).

## Decision

**Defer an append-only review log until after the unpaid public beta.** Keep whole-record LWW and document the limitation. If beta users report lost grades or week flags, add append-only review events and derive level / due date / day completion from them (see roadmap Phase 3 follow-up).

## Alternatives

- Field-level merge on card/topic records — still loses multi-grade history and is harder to reason about than events.
- Keep LWW and document — chosen for beta.
- Append-only review log now — correct model, but adds schema, migration, replay, and client apply path before we know whether users hit the bug in practice.

## Trade-offs

Event log is the right long-term model for study correctness. Shipping it before beta delays production hardening that already unblocks other people's data (sync cursor, opId, deploy, auth). Deferral accepts rare lost grades under concurrent multi-device study.

## Consequences

- No schema or protocol change for reviews in Phase 3.
- Product copy / known-limitations should mention two-device grade races.
- Trigger to revisit: user reports of lost grades, or post-beta engineering capacity for schema + replay.
