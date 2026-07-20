import fs from 'node:fs'
import path from 'node:path'
import { getRepoRoot } from '../../config/env.js'
import type { VirtualPasskey } from './virtual-authenticator.js'

const AUTH_DIR = path.join(getRepoRoot(), 'testing/.auth')

export function savePasskey(
  credential: VirtualPasskey,
  fileName = 'passkey.json'
): string {
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  const filePath = path.join(AUTH_DIR, fileName)
  fs.writeFileSync(filePath, JSON.stringify(credential, null, 2))
  return filePath
}

export function loadPasskey(fileName = 'passkey.json'): VirtualPasskey {
  const filePath = path.join(AUTH_DIR, fileName)
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Passkey file not found: ${filePath}. Register a passkey in a setup test first.`
    )
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as VirtualPasskey
}
