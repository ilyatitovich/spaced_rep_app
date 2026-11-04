#!/usr/bin/env node
/**
 * First-load performance smoke against a running client preview.
 * Uses Playwright Chromium (already a repo dependency) — no LHCI install.
 *
 * Env: PERF_CLIENT_URL (default http://127.0.0.1:4173)
 * Budgets: testing/perf/budgets.json → fcpMs / loadEventMs
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const budgets = JSON.parse(
  readFileSync(join(root, 'testing/perf/budgets.json'), 'utf8')
)
const url = process.env.PERF_CLIENT_URL ?? 'http://127.0.0.1:4173'
const outDir = join(root, 'testing/perf/baselines')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(url, { waitUntil: 'load', timeout: 60_000 })
const metrics = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0]
  const paints = Object.fromEntries(
    performance.getEntriesByType('paint').map(p => [p.name, p.startTime])
  )
  return {
    fcpMs: paints['first-contentful-paint'] ?? null,
    domContentLoadedMs: nav?.domContentLoadedEventEnd ?? null,
    loadEventMs: nav?.loadEventEnd ?? null,
    transferSize: nav?.transferSize ?? null
  }
})
await browser.close()

const report = {
  measuredAt: new Date().toISOString(),
  url,
  ...metrics,
  budgets: {
    fcpMs: budgets.fcpMs,
    loadEventMs: budgets.loadEventMs
  }
}

mkdirSync(outDir, { recursive: true })
writeFileSync(
  join(outDir, 'lighthouse-smoke.json'),
  `${JSON.stringify(report, null, 2)}\n`
)
console.log(JSON.stringify(report, null, 2))

const failures = []
if (metrics.fcpMs != null && metrics.fcpMs > budgets.fcpMs) {
  failures.push(`FCP ${metrics.fcpMs}ms > ${budgets.fcpMs}ms`)
}
if (metrics.loadEventMs != null && metrics.loadEventMs > budgets.loadEventMs) {
  failures.push(`load ${metrics.loadEventMs}ms > ${budgets.loadEventMs}ms`)
}
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
