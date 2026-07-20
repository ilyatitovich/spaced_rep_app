# Oxlint migration notes

Replaced ESLint 9 (flat config in `eslint.config.js`) with [oxlint](https://oxc.rs/docs/guide/usage/linter).

## Removed ESLint packages

From `apps/client`:

- `eslint`
- `@typescript-eslint/eslint-plugin`
- `@typescript-eslint/parser`
- `eslint-plugin-jsx-a11y`
- `eslint-plugin-perfectionist`
- `eslint-plugin-react`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `eslint-plugin-sonarjs`

## Rules / plugins not migrated

| Previous                      | Reason                                                               |
| ----------------------------- | -------------------------------------------------------------------- |
| `perfectionist/sort-imports`  | No native oxlint equivalent; import sort order is no longer enforced |
| `eslint-plugin-sonarjs`       | Was already disabled in `eslint.config.js`                           |
| `eslint-plugin-react-refresh` | Dependency existed but was never registered in the ESLint config     |

## Rules disabled to avoid app-code edits on migration

| Rule                                    | Why                                                              |
| --------------------------------------- | ---------------------------------------------------------------- |
| `eslint/no-empty-pattern`               | Playwright fixtures (`async ({}, use)`) and empty props patterns |
| `typescript/no-useless-empty-export`    | Ambient `export {}` in Express `.d.ts`                           |
| `jsx-a11y/prefer-tag-over-role`         | Existing role-based markup                                       |
| `jsx-a11y/no-autofocus`                 | OTP form autofocus                                               |
| `jsx-a11y/role-has-required-aria-props` | Custom switch controls                                           |
| `jsx-a11y/control-has-associated-label` | Icon-only buttons                                                |

Re-enable these gradually when cleaning up UI a11y.

## Preserved behavior (approximate)

- TypeScript unused vars with `^_` ignore patterns
- React 17+ JSX runtime (`react-in-jsx-scope` / `jsx-uses-react` off)
- React Hooks correctness checks (oxlint `react` plugin)
- jsx-a11y correctness checks (oxlint `jsx-a11y` plugin)
- Ignores for `dist` / `dev-dist` (plus coverage, reports, Prisma generated client)

## Commands

```bash
pnpm lint          # oxlint .
pnpm lint:fix     # oxlint --fix .
pnpm format        # prettier --write
pnpm format:check  # prettier --check (used by pre-commit)
```

Pre-commit (Husky) runs `pnpm lint` and `pnpm format:check`.
