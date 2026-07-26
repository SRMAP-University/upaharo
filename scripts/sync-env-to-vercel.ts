/**
 * Sync .env.local keys to Vercel production (+ preview).
 * Skips localhost URL overrides and Vercel-managed tokens.
 *
 * Usage: npx tsx scripts/sync-env-to-vercel.ts
 */
import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')

const SKIP = new Set([
  'VERCEL_OIDC_TOKEN',
  'NX_DAEMON',
  'TURBO_CACHE',
  'TURBO_DOWNLOAD_LOCAL_ENABLED',
  'TURBO_REMOTE_ONLY',
  'TURBO_RUN_SUMMARY',
])

/** Never push local-dev URLs over production site URLs */
const PROTECT_IF_LOCAL = new Set([
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SOCKET_URL',
])

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
    // Unescape common dotenv sequences
    val = val.replace(/\\n/g, '\n').replace(/\\"/g, '"')
    out[key] = val
  }
  return out
}

function isLocalUrl(value: string) {
  return /localhost|127\.0\.0\.1/i.test(value)
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
  let ok = 0
  let skipped = 0
  let failed = 0

  for (const [key, value] of Object.entries(env)) {
    if (SKIP.has(key)) {
      console.log(`SKIP ${key} (managed/local-only)`)
      skipped++
      continue
    }
    if (!value) {
      console.log(`SKIP ${key} (empty)`)
      skipped++
      continue
    }
    if (PROTECT_IF_LOCAL.has(key) && isLocalUrl(value)) {
      console.log(`SKIP ${key} (localhost — keep Vercel production URL)`)
      skipped++
      continue
    }

    const prodOk = setEnv(key, value, 'production')
    const previewOk = setEnv(key, value, 'preview')
    if (prodOk && previewOk) ok++
    else failed++
  }

  console.log(`\nDone. synced=${ok} skipped=${skipped} failed=${failed}`)
  if (failed > 0) process.exit(1)
}

main()
