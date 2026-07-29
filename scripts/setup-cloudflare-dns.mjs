#!/usr/bin/env node
/**
 * Update Cloudflare DNS + SSL for upaharo.com → EC2
 * Uses wrangler OAuth token from ~/.wrangler/config/default.toml
 */
import fs from 'fs'
import os from 'os'
import path from 'path'

const ZONE_ID = '9b1a1424104d4203c9a5a357ca34275e'
const TARGET_IP = process.argv[2] || '3.111.32.194'
function wranglerConfigPath() {
  const candidates = [
    path.join(os.homedir(), '.wrangler', 'config', 'default.toml'),
    path.join(
      process.env.APPDATA || '',
      'xdg.config',
      '.wrangler',
      'config',
      'default.toml'
    ),
  ]
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p
  }
  throw new Error('wrangler config not found — run: npx wrangler login')
}

function readOAuthToken() {
  const text = fs.readFileSync(wranglerConfigPath(), 'utf8')
  const m = text.match(/^oauth_token\s*=\s*"([^"]+)"/m)
  if (!m) throw new Error('No oauth_token in wrangler config — run: npx wrangler login')
  return m[1]
}

async function cf(path, init = {}) {
  const token = readOAuthToken()
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const json = await res.json()
  if (!json.success) {
    throw new Error(`${path}: ${JSON.stringify(json.errors || json)}`)
  }
  return json
}

async function upsertRecord(type, name, content, proxied = true) {
  const list = await cf(
    `/zones/${ZONE_ID}/dns_records?type=${type}&name=${encodeURIComponent(name)}`
  )
  const body = {
    type,
    name,
    content,
    proxied,
    ttl: proxied ? 1 : 300,
  }
  if (list.result.length) {
    const id = list.result[0].id
    console.log(`UPDATE ${name} → ${content}`)
    return cf(`/zones/${ZONE_ID}/dns_records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  }
  console.log(`CREATE ${name} → ${content}`)
  return cf(`/zones/${ZONE_ID}/dns_records`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

async function main() {
  console.log(`Pointing upaharo.com + www to ${TARGET_IP} (proxied)`)

  await upsertRecord('A', 'upaharo.com', TARGET_IP, true)
  await upsertRecord('A', 'www.upaharo.com', TARGET_IP, true)

  console.log('Setting SSL mode → strict')
  await cf(`/zones/${ZONE_ID}/settings/ssl`, {
    method: 'PATCH',
    body: JSON.stringify({ value: 'strict' }),
  })

  console.log('Enabling Always Use HTTPS')
  await cf(`/zones/${ZONE_ID}/settings/always_use_https`, {
    method: 'PATCH',
    body: JSON.stringify({ value: 'on' }),
  })

  console.log('Creating Origin CA certificate…')
  const cert = await cf('/certificates', {
    method: 'POST',
    body: JSON.stringify({
      hostnames: ['upaharo.com', '*.upaharo.com', 'www.upaharo.com'],
      requested_validity: 5475,
      request_type: 'origin-rsa',
    }),
  })

  const outDir = path.join(os.tmpdir(), 'upaharo-origin-cert')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'origin.pem'), cert.result.certificate, 'utf8')
  fs.writeFileSync(path.join(outDir, 'origin-key.pem'), cert.result.private_key, 'utf8')
  console.log(`Origin cert saved to ${outDir}`)
  console.log('Done.')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
