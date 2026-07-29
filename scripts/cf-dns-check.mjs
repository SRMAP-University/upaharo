#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const ZONE = '9b1a1424104d4203c9a5a357ca34275e'

function wranglerToken() {
  const cfg = path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml')
  const m = fs.readFileSync(cfg, 'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)
  return m?.[1]
}

function cfToken() {
  const envLocal = path.join(process.cwd(), '.env.local')
  const m = fs.readFileSync(envLocal, 'utf8').match(/^CF_API_TOKEN=(.+)$/m)
  return m?.[1]?.replace(/^["']|["']$/g, '')
}

async function list(token, label) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records?per_page=100`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const j = await r.json()
  console.log(`\n${label}: success=${j.success}`)
  if (!j.success) {
    console.log(JSON.stringify(j.errors))
    return
  }
  for (const rec of j.result.filter((x) => x.name.includes('upaharo'))) {
    console.log(`  ${rec.type} ${rec.name} → ${rec.content} proxied=${rec.proxied}`)
  }
}

await list(wranglerToken(), 'wrangler oauth')
await list(cfToken(), 'CF_API_TOKEN')
