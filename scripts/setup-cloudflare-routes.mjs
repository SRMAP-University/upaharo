#!/usr/bin/env node
import fs from 'fs'
import os from 'os'
import path from 'path'

const ZONE_ID = '9b1a1424104d4203c9a5a357ca34275e'

function readOAuthToken() {
  const candidates = [
    path.join(os.homedir(), '.wrangler', 'config', 'default.toml'),
    path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const m = fs.readFileSync(p, 'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)
      if (m) return m[1]
    }
  }
  throw new Error('No wrangler oauth token')
}

async function cf(apiPath, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${apiPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${readOAuthToken()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const json = await res.json()
  return json
}

async function main() {
  const existing = await cf(`/zones/${ZONE_ID}/workers/routes`)
  console.log('Existing routes:', existing.result?.length ?? existing.errors)

  for (const pattern of ['www.upaharo.com/*', 'upaharo.com/*']) {
    const hit = existing.result?.find((r) => r.pattern === pattern)
    if (hit) {
      console.log(`Route exists: ${pattern} -> ${hit.script}`)
      continue
    }
    const created = await cf(`/zones/${ZONE_ID}/workers/routes`, {
      method: 'POST',
      body: JSON.stringify({ pattern, script: 'upaharo-proxy' }),
    })
    if (!created.success) {
      console.error(`Failed ${pattern}:`, created.errors)
    } else {
      console.log(`Created route ${pattern} -> upaharo-proxy`)
    }
  }

  for (const setting of [
    ['ssl', 'strict'],
    ['always_use_https', 'on'],
    ['automatic_https_rewrites', 'on'],
  ]) {
    const [id, value] = setting
    const res = await cf(`/zones/${ZONE_ID}/settings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    })
    console.log(`SSL setting ${id}=${value}:`, res.success ? 'ok' : res.errors)
  }

  const listed = await cf(`/zones/${ZONE_ID}/workers/routes`)
  console.log('Routes now:', JSON.stringify(listed.result, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
