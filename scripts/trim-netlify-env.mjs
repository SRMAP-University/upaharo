/**
 * Trim Netlify env under Lambda 4KB limit:
 * - Remove unused Dodo payment vars
 * - Move FIREBASE_SERVICE_ACCOUNT_JSON to builds-only scope
 *
 * Usage: node scripts/trim-netlify-env.mjs
 */
import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function run(args) {
  const result = spawnSync('npx', ['netlify', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  })
  const out = `${result.stdout || ''}${result.stderr || ''}`.trim()
  if (result.status !== 0) {
    console.error('FAIL', args.join(' '), out.slice(0, 400))
    return false
  }
  console.log('OK ', args.slice(0, 4).join(' '))
  return true
}

function parseEnv(text) {
  const out = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    let val = line.slice(i + 1)
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[line.slice(0, i)] = val
  }
  return out
}

const unsetKeys = [
  'DODO_PAYMENTS_COUNTRY',
  'DODO_PAYMENTS_CURRENCY',
  'DODO_PAYMENTS_ENVIRONMENT',
  'DODO_PAYMENTS_PRODUCT_ID',
  'DODO_PAYMENTS_WEBHOOK_SECRET',
  'DODO_PAYMENTS_API_KEY',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
]

for (const key of unsetKeys) {
  for (const context of ['production', 'deploy-preview']) {
    run(['env:unset', key, '--context', context, '--force'])
  }
}

const local = parseEnv(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8'))
const firebase = local.FIREBASE_SERVICE_ACCOUNT_JSON
if (firebase) {
  for (const context of ['production', 'deploy-preview']) {
    run([
      'env:set',
      'FIREBASE_SERVICE_ACCOUNT_JSON',
      firebase,
      '--context',
      context,
      '--scope',
      'builds',
      '--force',
    ])
  }
} else {
  console.log('SKIP FIREBASE (missing in .env.local)')
}

console.log('\nTrim complete.')
