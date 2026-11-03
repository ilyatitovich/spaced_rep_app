import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * Drives infra/backup/{backup,restore}.sh with stubbed pg_dump / psql / aws /
 * wget, real gpg / gzip / openssl. The scripts' SQL against a real database is
 * exercised by infra/smoke/backup-restore.sh (CI job "Backup restore drill").
 */

const scripts = resolve(import.meta.dirname, '../../infra/backup')
const KEY = 'drill passphrase with "quotes" and $dollars'

const DUMP = [
  '-- PostgreSQL database dump',
  'CREATE TABLE public.users (id integer, name text);',
  'CREATE TABLE public.cards (id integer, body jsonb);',
  "INSERT INTO public.users VALUES (1, 'ü');",
  '-- PostgreSQL database dump complete',
  ''
].join('\n')

const stubDir = resolve(import.meta.dirname, 'stubs')

let root: string
let backups: string
let log: string
let env: Record<string, string>

function run(
  script: string,
  args: string[] = [],
  extra: Record<string, string> = {}
) {
  const result = spawnSync('sh', [join(scripts, script), ...args], {
    env: { ...env, ...extra },
    encoding: 'utf8'
  })
  return {
    status: result.status,
    out: `${result.stdout}${result.stderr}`
  }
}

/** Fails with the script's output attached, which `expect(x, message)` would not allow here. */
function expectOk(result: { status: number | null; out: string }): void {
  expect({ status: result.status, out: result.out }).toMatchObject({
    status: 0
  })
}

function logLines(): string[] {
  return existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : []
}

function backupFiles(): string[] {
  return readdirSync(backups).filter(name => !name.startsWith('.'))
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'bk-'))
  backups = join(root, 'backups')
  mkdirSync(backups)
  const bin = join(root, 'bin')
  mkdirSync(bin)
  for (const name of readdirSync(stubDir)) {
    copyFileSync(join(stubDir, name), join(bin, name))
    chmodSync(join(bin, name), 0o755)
  }
  writeFileSync(join(root, 'dump.sql'), DUMP)
  log = join(root, 'calls.log')
  env = {
    PATH: `${bin}:${process.env.PATH ?? ''}`,
    HOME: root,
    TMPDIR: root,
    BACKUP_DIR: backups,
    BACKUP_ENCRYPTION_KEY: KEY,
    BACKUP_MIN_DUMP_BYTES: '100',
    POSTGRES_USER: 'u',
    POSTGRES_PASSWORD: 'p',
    POSTGRES_DB: 'd',
    STUB_DUMP_FILE: join(root, 'dump.sql'),
    STUB_LOG: log,
    STUB_APPLIED: join(root, 'applied.sql'),
    TARGET_DATABASE_URL: 'postgresql://stub/scratch'
  }
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('backup.sh', () => {
  it('writes one encrypted file, leaves no plaintext behind and pings success', () => {
    const result = run('backup.sh', [], {
      BACKUP_HEARTBEAT_URL: 'https://hc.example/abc'
    })

    expectOk(result)
    const files = readdirSync(backups)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^spaced_rep_\d{8}T\d{6}Z\.sql\.gz\.gpg$/)
    expect(
      readFileSync(join(backups, files[0]!)).includes('CREATE TABLE')
    ).toBe(false)
    expect(logLines()).toEqual([
      'wget -q -T 10 -O /dev/null https://hc.example/abc'
    ])
  })

  it.each([
    ['an empty dump', 'empty', /only 0 bytes/],
    [
      'a pg_dump that exits non-zero mid-stream',
      'fail',
      /pg_dump exited with an error/
    ],
    ['a truncated dump', 'truncated', /truncated/],
    ['a dump without tables', 'notables', /no tables/]
  ])('keeps nothing and alerts for %s', (_name, mode, message) => {
    const result = run('backup.sh', [], {
      STUB_PG_DUMP: mode,
      BACKUP_MIN_DUMP_BYTES: '10',
      BACKUP_HEARTBEAT_URL: 'https://hc.example/abc'
    })

    expect(result.status).toBe(1)
    expect(result.out).toMatch(message)
    expect(backupFiles()).toEqual([])
    expect(readdirSync(backups)).toEqual([])
    expect(logLines()).toEqual([
      'wget -q -T 10 -O /dev/null https://hc.example/abc/fail'
    ])
  })

  it('still fails when the alert endpoint is down', () => {
    const result = run('backup.sh', [], {
      STUB_PG_DUMP: 'empty',
      BACKUP_HEARTBEAT_URL: 'https://hc.example/abc',
      STUB_WGET_EXIT: '1'
    })

    expect(result.status).toBe(1)
    expect(result.out).toMatch(/could not reach BACKUP_HEARTBEAT_URL/)
  })

  it('requires an encryption key', () => {
    const result = run('backup.sh', [], { BACKUP_ENCRYPTION_KEY: '' })

    expect(result.status).toBe(1)
    expect(result.out).toMatch(/BACKUP_ENCRYPTION_KEY is required/)
  })

  it('copies the backup offsite to the configured bucket', () => {
    const result = run('backup.sh', [], {
      BACKUP_S3_BUCKET: 'dr-bucket',
      BACKUP_S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
      BACKUP_S3_PREFIX: 'prod'
    })

    expectOk(result)
    const [name] = backupFiles()
    expect(logLines()).toEqual([
      `aws s3 cp ${backups}/${name} s3://dr-bucket/prod/${name} --endpoint-url https://acct.r2.cloudflarestorage.com --only-show-errors`
    ])
  })

  it('fails and alerts when the offsite copy fails, keeping the local file', () => {
    const result = run('backup.sh', [], {
      BACKUP_S3_BUCKET: 'dr-bucket',
      STUB_AWS_EXIT: '1',
      BACKUP_HEARTBEAT_URL: 'https://hc.example/abc'
    })

    expect(result.status).toBe(1)
    expect(result.out).toMatch(/offsite upload failed/)
    expect(backupFiles()).toHaveLength(1)
    expect(logLines().at(-1)).toBe(
      'wget -q -T 10 -O /dev/null https://hc.example/abc/fail'
    )
  })

  it('keeps only the newest BACKUP_KEEP_COUNT local files, legacy ones included', () => {
    for (const name of [
      'spaced_rep_20200101T000000Z.sql.gz.enc',
      'spaced_rep_20200102T000000Z.sql.gz.gpg',
      'spaced_rep_20200103T000000Z.sql.gz.gpg'
    ]) {
      const path = join(backups, name)
      writeFileSync(path, 'x')
      const age = new Date(
        `${name.slice(11, 15)}-${name.slice(15, 17)}-${name.slice(17, 19)}`
      )
      spawnSync('touch', ['-d', age.toISOString(), path])
    }

    const result = run('backup.sh', [], { BACKUP_KEEP_COUNT: '2' })

    expectOk(result)
    const files = backupFiles()
    expect(files).toHaveLength(2)
    expect(files).toContain('spaced_rep_20200103T000000Z.sql.gz.gpg')
    expect(files).not.toContain('spaced_rep_20200101T000000Z.sql.gz.enc')
  })
})

describe('restore.sh', () => {
  function makeBackup(): string {
    const result = run('backup.sh')
    expectOk(result)
    return join(backups, backupFiles()[0]!)
  }

  it('decrypts the latest backup and applies the original SQL', () => {
    makeBackup()

    const result = run('restore.sh', ['latest'])

    expectOk(result)
    expect(readFileSync(env.STUB_APPLIED!, 'utf8')).toBe(DUMP)
    expect(result.out).toMatch(/restore: OK \(2 tables, 7 rows\)/)
  })

  it('refuses a wrong key', () => {
    const file = makeBackup()

    const result = run('restore.sh', [file], { BACKUP_ENCRYPTION_KEY: 'nope' })

    expect(result.status).toBe(1)
    expect(result.out).toMatch(/decryption failed/)
    expect(existsSync(env.STUB_APPLIED!)).toBe(false)
  })

  it('refuses a backup that was modified (authenticated encryption)', () => {
    const file = makeBackup()
    const bytes = readFileSync(file)
    bytes[bytes.length - 20] = bytes[bytes.length - 20]! ^ 0xff
    writeFileSync(file, bytes)

    const result = run('restore.sh', [file])

    expect(result.status).toBe(1)
    expect(result.out).toMatch(/decryption failed/)
    expect(existsSync(env.STUB_APPLIED!)).toBe(false)
  })

  it('refuses a truncated backup', () => {
    const file = makeBackup()
    writeFileSync(file, readFileSync(file).subarray(0, 60))

    const result = run('restore.sh', [file])

    expect(result.status).toBe(1)
    expect(existsSync(env.STUB_APPLIED!)).toBe(false)
  })

  it('refuses to restore into a populated database unless forced', () => {
    const file = makeBackup()

    const refused = run('restore.sh', [file], { STUB_TARGET_TABLES: '5' })
    const forced = run('restore.sh', [file], {
      STUB_TARGET_TABLES: '5',
      RESTORE_FORCE: '1'
    })

    expect(refused.status).toBe(1)
    expect(refused.out).toMatch(/already has 5 tables/)
    expectOk(forced)
  })

  it('fails when the restored database has no rows', () => {
    const file = makeBackup()

    const result = run('restore.sh', [file], {
      STUB_COUNTS: 'users 0\\ncards 0\\n'
    })

    expect(result.status).toBe(1)
    expect(result.out).toMatch(/no rows/)
  })

  it('fails when psql cannot apply the dump', () => {
    const file = makeBackup()

    const result = run('restore.sh', [file], { STUB_PSQL_FAIL: '1' })

    expect(result.status).toBe(1)
  })

  it('restores legacy openssl backups made before the gpg switch', () => {
    const legacy = join(backups, 'spaced_rep_20200101T000000Z.sql.gz.enc')
    const gz = join(root, 'legacy.sql.gz')
    expect(
      spawnSync('sh', [
        '-c',
        `gzip -c "$1" > "$2"`,
        'sh',
        env.STUB_DUMP_FILE!,
        gz
      ]).status
    ).toBe(0)
    const enc = spawnSync(
      'openssl',
      [
        'enc',
        '-aes-256-cbc',
        '-pbkdf2',
        '-salt',
        '-pass',
        'env:BK',
        '-in',
        gz,
        '-out',
        legacy
      ],
      { env: { ...process.env, BK: KEY } }
    )
    expect(enc.status).toBe(0)

    const result = run('restore.sh', [legacy])

    expectOk(result)
    expect(readFileSync(env.STUB_APPLIED!, 'utf8')).toBe(DUMP)
  })

  it('downloads s3:// sources through aws first', () => {
    const result = run('restore.sh', ['s3://dr-bucket/prod/x.sql.gz.gpg'], {
      BACKUP_S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com'
    })

    expect(logLines()[0]).toMatch(
      /^aws s3 cp s3:\/\/dr-bucket\/prod\/x\.sql\.gz\.gpg .*--endpoint-url https:\/\/acct\.r2\.cloudflarestorage\.com/
    )
    // The stub downloads nothing, so the run stops at "no such file".
    expect(result.status).toBe(1)
  })
})
