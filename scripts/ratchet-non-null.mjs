#!/usr/bin/env node
/**
 * Ratchet for typescript/no-non-null-assertion: the count may only drop.
 * Baseline file: .non-null-baseline (integer, one line).
 *
 * Locally, a lower count rewrites the baseline (stage it).
 * In CI, a lower count fails until the baseline file is committed.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = join(root, '.non-null-baseline')
const baseline = Number(readFileSync(baselinePath, 'utf8').trim())
if (!Number.isInteger(baseline) || baseline < 0) {
  console.error(`invalid baseline in ${baselinePath}`)
  process.exit(1)
}

const result = spawnSync(
  'pnpm',
  [
    'exec',
    'oxlint',
    '-A',
    'all',
    '-W',
    'typescript/no-non-null-assertion',
    '--format=json',
    '.'
  ],
  { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
)

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

let diagnostics
try {
  diagnostics = JSON.parse(result.stdout).diagnostics
} catch {
  console.error('oxlint JSON parse failed')
  console.error(result.stderr || result.stdout)
  process.exit(1)
}

const count = Array.isArray(diagnostics) ? diagnostics.length : 0

if (count > baseline) {
  console.error(
    `no-non-null-assertion rose: ${count} > baseline ${baseline}. Remove assertions; do not raise the baseline.`
  )
  process.exit(1)
}

if (count < baseline) {
  if (process.env.CI) {
    console.error(
      `no-non-null-assertion dropped to ${count}. Update .non-null-baseline from ${baseline} to ${count} and commit it.`
    )
    process.exit(1)
  }
  writeFileSync(baselinePath, `${count}\n`)
  console.log(
    `ratchet: .non-null-baseline ${baseline} → ${count} (stage the file)`
  )
  process.exit(0)
}

console.log(`no-non-null-assertion: ${count} (at baseline)`)
