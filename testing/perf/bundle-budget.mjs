#!/usr/bin/env node
/**
 * Fails if client build assets exceed budgets in testing/perf/budgets.json.
 * Run after `pnpm --filter spaced_rep_pwa_client build`.
 *
 * Counts shipped files only (excludes .map). Hidden sourcemaps dominate dist
 * and are deleted after Sentry upload when SENTRY_AUTH_TOKEN is set.
 *
 * Budgets are measured ceilings (not optimization targets). Lower them only
 * after a deliberate size win; never raise without recording why in the PR.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const budgets = JSON.parse(
  readFileSync(join(root, 'testing/perf/budgets.json'), 'utf8')
)
const dist = join(root, 'apps/client/dist')

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else out.push(path)
  }
  return out
}

let files
try {
  files = walk(dist)
} catch {
  console.error(`missing ${dist}; build the client first`)
  process.exit(1)
}

// Sourcemaps are not shipped to browsers (hidden) and are stripped on release
// upload; including them made the total flaky and map-dominated (~16MB).
const shipped = files.filter(f => !f.endsWith('.map'))
const totalBytes = shipped.reduce((sum, f) => sum + statSync(f).size, 0)
const jsAssets = shipped.filter(
  f => f.includes(`${join('dist', 'assets')}`) && f.endsWith('.js')
)
const largestJs = Math.max(0, ...jsAssets.map(f => statSync(f).size))

const failures = []
if (totalBytes > budgets.distTotalBytes) {
  failures.push(`dist total ${totalBytes} > budget ${budgets.distTotalBytes}`)
}
if (largestJs > budgets.largestJsAssetBytes) {
  failures.push(
    `largest JS asset ${largestJs} > budget ${budgets.largestJsAssetBytes}`
  )
}

console.log(
  JSON.stringify(
    {
      distTotalBytes: totalBytes,
      largestJsAssetBytes: largestJs,
      budgets
    },
    null,
    2
  )
)

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
