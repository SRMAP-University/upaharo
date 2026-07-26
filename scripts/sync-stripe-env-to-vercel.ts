/**
 * Sync Stripe keys from .env.local to Vercel production + preview.
 * Usage: npx tsx scripts/sync-stripe-env-to-vercel.ts
 */
import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')

const KEYS = [
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_CURRENCY',
] as const

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const key = line.slice(0, i)
    let val = line.slice(i + 1)
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val.replace(/\\n/g, '\n').replace(/\\"/g, '"')
  }
  return out
}

function setEnv(key: string, value: string, environment: 'production' | 'preview') {
  const result = spawnSync(
    'npx',
    ['vercel', 'env', 'add', key, environment, '--force'],
    {
      cwd: ROOT,
      input: value,
      encoding: 'utf8',
      shell: true,
    }
  )
  if (result.status !== 0) {
    console.error(`FAIL ${key} (${environment}):`, result.stderr || result.stdout)
    return false
  }
  console.log(`OK  ${key} → ${environment}`)
  return true
}

function main() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error('Missing .env.local')
    process.exit(1)
  }

  const env = parseEnv(fs.readFileSync(ENV_PATH, 'utf8'))
  let failed = 0

  for (const key of KEYS) {
    const value = env[key]
    if (!value) {
      console.log(`SKIP ${key} (missing)`)
      failed++
      continue
    }
    for (const environment of ['production', 'preview'] as const) {
      if (!setEnv(key, value, environment)) failed++
    }
  }

  if (failed > 0) process.exit(1)
  console.log('\nStripe env synced to Vercel.')
}

main()
