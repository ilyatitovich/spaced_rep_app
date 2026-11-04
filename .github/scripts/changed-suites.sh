#!/usr/bin/env bash
# Decide which test suites a push or pull request affects.
# BASE_SHA is the PR base, or the commit this push replaced.
# COMPARE_TO defaults to HEAD.
# Writes key=true|false to $GITHUB_OUTPUT when that variable is set.
#
# A suite runs when the code it covers changes, not only when its test file does.
set -euo pipefail

base="${BASE_SHA:-}"
run_all=false

if [ -z "$base" ] || [ "$base" = "0000000000000000000000000000000000000000" ]; then
  echo "No base commit; running every suite"
  run_all=true
elif ! git cat-file -e "${base}^{commit}" >/dev/null 2>&1; then
  echo "Base commit $base is not in this clone; running every suite"
  run_all=true
fi

tip="${COMPARE_TO:-HEAD}"

changed() {
  if [ "$run_all" = true ]; then
    return 0
  fi
  [ -n "$(git diff --name-only "$base" "$tip" -- "$@")" ]
}

emit() {
  echo "$1=$2"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "$1=$2" >> "$GITHUB_OUTPUT"
  fi
}

if [ "$run_all" = false ]; then
  echo "Changed files:"
  git diff --name-only "$base" "$tip"
fi

# Workflow, install, and toolchain edits can affect every Node suite and the image.
shared=(
  .github/workflows/tests.yml
  .github/actions
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  tsconfig.base.json
  .node-version
)

if changed "${shared[@]}" apps packages testing infra/backup vitest.config.ts vitest.mutation.config.ts; then
  emit unit true
else
  emit unit false
fi

if changed "${shared[@]}" apps/server packages/sync-protocol testing; then
  emit integration true
else
  emit integration false
fi

if changed "${shared[@]}" \
  apps/client apps/server packages e2e playwright.config.ts \
  testing/helpers testing/fixtures testing/factories testing/setup testing/db testing/config; then
  emit e2e true
else
  emit e2e false
fi

if changed "${shared[@]}" apps/server packages/sync-protocol infra/smoke/boot-image.sh docker-compose.prod.yml; then
  emit image true
else
  emit image false
fi

if changed .github/workflows/tests.yml infra/backup infra/smoke/backup-restore.sh testing/infra; then
  emit backup true
else
  emit backup false
fi
