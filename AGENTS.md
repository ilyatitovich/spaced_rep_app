## Anti-Slop Checks

- Fix what a check finds; don't silence it. No new `!`, `as any`, `@ts-expect-error`, or disable comments to get a check green.
- A lint message says what failed, why the rule exists, and what to do instead.
- `typescript/no-non-null-assertion` is a warning with a ratchet (`.non-null-baseline`): the count may only drop. After removing assertions, re-run `pnpm lint` locally so the baseline file updates, then stage it. CI fails if the count rises or if the baseline is stale.

Commands:

- `pnpm lint`: services stay UI-free, `components/ui` stays free of app state and domain code, `lib` / `types` / `config` don't import services or UI, the router only imports pages, and production code doesn't import mocks or tests. Also runs the non-null ratchet.
