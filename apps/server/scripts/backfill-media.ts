/**
 * Protocol v3 media backfill
 *
 * Cutover order (hard cut — no mixed-client compatibility):
 * 1. Deploy server with media routes + private R2/MinIO configured
 * 2. Release PWA and browser extension on protocol v3 together
 *    (older clients keep local outboxes and show update-required via PROTOCOL_MISMATCH)
 * 3. Run this script after v3 is live
 * 4. Fresh devices bootstrap refs and hydrate; existing devices keep local buffers
 *    until their next v3 push
 *
 * Idempotent / LWW-safe:
 * - Skips cards that already use wire refs
 * - Uploads to R2 before rewriting Postgres JSON
 * - Never writes `updatedAt` (representation-only migration must not win LWW)
 *
 * Usage:
 *   pnpm --filter spaced_rep_pwa_server backfill:media
 *   pnpm --filter spaced_rep_pwa_server backfill:media -- --dry-run
 *   pnpm --filter spaced_rep_pwa_server backfill:media -- --user-id <uuid>
 *   pnpm --filter spaced_rep_pwa_server backfill:media -- --batch-size 50
 */
import { disconnectPrisma, prisma } from '../src/shared/lib/prisma.js'
import { createR2StorageFromEnv } from '../src/shared/lib/r2-storage.js'
import { runMediaBackfill } from '../src/sync/backfill-media.js'

function parseArgs(argv: string[]) {
  let dryRun = false
  let userId: string | undefined
  let batchSize = 100

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--dry-run') dryRun = true
    else if (arg === '--user-id') {
      userId = argv[++i]
      if (!userId) throw new Error('--user-id requires a uuid')
    } else if (arg === '--batch-size') {
      const raw = argv[++i]
      batchSize = Number(raw)
      if (!Number.isInteger(batchSize) || batchSize <= 0) {
        throw new Error('--batch-size must be a positive integer')
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: backfill:media [--dry-run] [--user-id <uuid>] [--batch-size N]`)
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return { dryRun, userId, batchSize }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const storage = createR2StorageFromEnv()

  console.log(
    opts.dryRun
      ? 'Dry run — scanning cards, no R2 uploads or DB writes'
      : 'Backfilling base64 card media → R2 refs (updatedAt unchanged)'
  )

  const stats = await runMediaBackfill({
    prisma,
    storage,
    dryRun: opts.dryRun,
    userId: opts.userId,
    batchSize: opts.batchSize,
    onProgress: s => {
      if (s.scanned % opts.batchSize === 0) {
        console.log(
          `… scanned=${s.scanned} rewritten=${s.rewritten} skipped=${s.skipped} uploaded=${s.uploaded} errors=${s.errors.length}`
        )
      }
    }
  })

  console.log(
    JSON.stringify(
      {
        dryRun: opts.dryRun,
        scanned: stats.scanned,
        rewritten: stats.rewritten,
        skipped: stats.skipped,
        uploaded: stats.uploaded,
        errorCount: stats.errors.length,
        errors: stats.errors.slice(0, 20)
      },
      null,
      2
    )
  )

  if (stats.errors.length > 0) process.exitCode = 1
}

main()
  .catch(err => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => disconnectPrisma())
