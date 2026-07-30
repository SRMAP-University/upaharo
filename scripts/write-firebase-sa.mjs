/**
 * Generate lib/firebase-sa.generated.ts from FIREBASE_SERVICE_ACCOUNT_JSON
 * so the service account is baked into the build instead of a huge env var.
 */
import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const outPath = path.join(ROOT, 'lib', 'firebase-sa.generated.ts')

function loadFromEnvFile() {
  try {
    const text = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line.startsWith('FIREBASE_SERVICE_ACCOUNT_JSON=')) continue
      let val = line.slice('FIREBASE_SERVICE_ACCOUNT_JSON='.length)
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      return val.trim()
    }
  } catch {
    // ignore
  }
  return ''
}

const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || loadFromEnvFile()).trim()

function parse(rawValue) {
  const trimmed = rawValue.trim()
  const attempts = [
    trimmed,
    trimmed.replace(/^"|"$/g, ''),
    trimmed.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/^"|"$/g, ''),
  ]
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8')
    if (decoded.trim().startsWith('{')) attempts.unshift(decoded)
  } catch {
    // ignore
  }
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed?.private_key && parsed?.client_email) {
        if (typeof parsed.private_key === 'string' && parsed.private_key.includes('\\n')) {
          parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
        }
        return parsed
      }
    } catch {
      // try next
    }
  }
  throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON')
}

if (!raw) {
  fs.writeFileSync(
    outPath,
    `/* auto-generated — do not commit secrets */\nexport const firebaseServiceAccount: Record<string, unknown> | null = null\n`,
    'utf8'
  )
  console.log('write-firebase-sa: no env — wrote null stub')
  process.exit(0)
}

const creds = parse(raw)
fs.writeFileSync(
  outPath,
  `/* auto-generated at build — do not commit */\nexport const firebaseServiceAccount: Record<string, unknown> = ${JSON.stringify(creds, null, 2)}\n`,
  'utf8'
)
console.log(`write-firebase-sa: wrote ${outPath}`)
