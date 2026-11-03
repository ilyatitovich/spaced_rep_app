const fs = require('node:fs')
const path = require('node:path')

const REPO = path.resolve(__dirname, '..')
const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json']

function aliasPath(source) {
  if (source.startsWith('@ext/')) {
    return path.join(
      REPO,
      'apps/browser-extension/src',
      source.slice('@ext/'.length)
    )
  }
  if (source.startsWith('@/')) {
    return path.join(REPO, 'apps/client/src', source.slice(2))
  }
  return null
}

function fileWithExtension(candidate) {
  const queryless = candidate.split('?')[0]
  if (fs.existsSync(queryless) && fs.statSync(queryless).isFile())
    return queryless
  if (queryless.endsWith('.js')) {
    const stem = queryless.slice(0, -3)
    for (const ext of ['.ts', '.tsx', '.js']) {
      if (fs.existsSync(stem + ext)) return stem + ext
    }
  }
  for (const ext of EXTENSIONS) {
    if (fs.existsSync(queryless + ext)) return queryless + ext
  }
  for (const ext of EXTENSIONS) {
    const index = path.join(queryless, `index${ext}`)
    if (fs.existsSync(index)) return index
  }
  return null
}

module.exports = {
  interfaceVersion: 2,
  resolve(source, file) {
    const clean = source.split('?')[0]
    const base = clean.startsWith('.')
      ? path.resolve(path.dirname(file), clean)
      : aliasPath(clean)
    if (!base) return { found: false }
    const hit = fileWithExtension(base)
    return hit ? { found: true, path: hit } : { found: false }
  }
}
