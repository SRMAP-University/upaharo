import fs from 'fs'

const text = fs.readFileSync('.env.local', 'utf8')
const env = {}
for (const raw of text.split(/\r?\n/)) {
  const line = raw.trim()
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  let v = line.slice(i + 1)
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1)
  }
  env[line.slice(0, i)] = v
}

const skip = new Set(['VERCEL_OIDC_TOKEN', 'NEXTAUTH_URL', 'NEXT_PUBLIC_APP_URL'])
let total = 0
const rows = []
for (const [k, v] of Object.entries(env)) {
  if (skip.has(k)) continue
  const n = Buffer.byteLength(`${k}=${v}`)
  total += n
  rows.push([n, k])
}
rows.sort((a, b) => b[0] - a[0])
console.log('total bytes', total)
for (const [n, k] of rows.slice(0, 20)) console.log(n, k)
