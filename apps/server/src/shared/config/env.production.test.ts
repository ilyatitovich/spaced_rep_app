import dotenv from 'dotenv'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Hermetic: a developer's real `apps/server/src/.env` must not change the outcome.
vi.mock('dotenv', () => ({ default: { config: vi.fn() } }))

const originalEnv = process.env

afterEach(() => {
  process.env = originalEnv
  vi.restoreAllMocks()
  vi.resetModules()
  vi.mocked(dotenv.config).mockClear()
})

function loadedFiles(): string[] {
  return vi
    .mocked(dotenv.config)
    .mock.calls.map(([options]) => String(options?.path))
}

async function importEnvExpectingExit(): Promise<void> {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('exit')
  }) as never)
  await expect(import('./env.js')).rejects.toThrow('exit')
}

describe('env loading', () => {
  it('does not fall back to the committed test stubs in production', async () => {
    process.env = { NODE_ENV: 'production' }

    await importEnvExpectingExit()

    expect(loadedFiles().some(file => file.endsWith('.env.test.example'))).toBe(
      false
    )
  })

  it('still falls back to the test stubs outside production (fresh clones, CI)', async () => {
    process.env = { NODE_ENV: 'test' }

    await importEnvExpectingExit()

    expect(loadedFiles().some(file => file.endsWith('.env.test.example'))).toBe(
      true
    )
  })
})
