#!/usr/bin/env node
/**
 * Update Cloudflare DNS for upaharo.com → EC2.
 * Uses CLOUDFLARE_DNS_API_TOKEN or CLOUDFLARE_API_TOKEN (Zone DNS Edit).
 */
import fs from 'fs'
import os from 'os'
import path from 'path'

const ZONE_ID = '9b1a1424104d4203c9a5a357ca34275e'
const TARGET_IP = process.argv[2] || '3.111.32.194'

function readToken() {
  if (process.env.CLOUDFLARE_DNS_API_TOKEN?.trim()) {
    return process.env.CLOUDFLARE_DNS_API_TOKEN.trim()
  }
  if (process.env.CLOUDFLARE_API_TOKEN?.trim()) {
    return process.env.CLOUDFLARE_API_TOKEN.trim()
  }
  for (const envFile of ['.env.local', '.env']) {
    const p = path.join(process.cwd(), envFile)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^CLOUDFLARE_DNS_API_TOKEN=(.+)$/)
      if (m) return m[1].replace(/^["']|["']$/g, '')
    }
  }
  throw new Error(
    'Set CLOUDFLARE_DNS_API_TOKEN with Zone → DNS → Edit for upaharo.com'
  )
}

async function cf(token, apiPath, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${apiPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const json = await res.json()
  if (!json.success) {
    throw new Error(`${apiPath}: ${JSON.stringify(json.errors || json)}`)
  }
  return json
}

async function upsertA(token, name) {
  const encoded = encodeURIComponent(name)
  const all = await cf(token, `/zones/${ZONE_ID}/dns_records?name=${encoded}`)
  for (const rec of all.result) {
    if (rec.type === 'CNAME') {
      await cf(token, `/zones/${ZONE_ID}/dns_records/${rec.id}`, { method: 'DELETE' })
      console.log(`Deleted CNAME ${name}`)
    }
  }
  const aRecords = all.result.filter((r) => r.type === 'A')
  const body = { type: 'A', name, content: TARGET_IP, proxied: true, ttl: 1 }
  if (aRecords.length) {
    await cf(token, `/zones/${ZONE_ID}/dns_records/${aRecords[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    console.log(`Updated A ${name} → ${TARGET_IP}`)
    for (const extra of aRecords.slice(1)) {
      await cf(token, `/zones/${ZONE_ID}/dns_records/${extra.id}`, { method: 'DELETE' })
    }
    return
  }
  await cf(token, `/zones/${ZONE_ID}/dns_records`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  console.log(`Created A ${name} → ${TARGET_IP}`)
}

const token = readToken()
await upsertA(token, 'upaharo.com')
await upsertA(token, 'www.upaharo.com')
console.log('DNS updated. SSL via Cloudflare proxy (Flexible → EC2 port 80).')
