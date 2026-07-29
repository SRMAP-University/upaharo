#!/usr/bin/env node
/**
 * Remove upaharo.com / www from Netlify so traffic goes to EC2 only.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'

const SITE_IDS = [
  '445e27e2-388d-4421-88dc-d5635dd2e06e', // production site "upaharo"
  'a8a24e22-d4a5-4de5-8bc6-fa304053f28c',
]
const HOSTS = ['www.upaharo.com', 'upaharo.com']

function readNetlifyToken() {
  const configPath = path.join(os.homedir(), '.netlify', 'config.json')
  if (!fs.existsSync(configPath)) {
    throw new Error('Netlify not logged in — run: npx netlify login')
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  const userId = Object.keys(config.users || {})[0]
  const token = config.users?.[userId]?.auth?.token
  if (!token) throw new Error('No Netlify auth token')
  return token
}

async function netlify(token, apiPath, init = {}) {
  const res = await fetch(`https://api.netlify.com/api/v1${apiPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: res.status, json }
}

const token = readNetlifyToken()

for (const siteId of SITE_IDS) {
  const { status, json } = await netlify(token, `/sites/${siteId}`)
  if (status !== 200) {
    console.log(`Site ${siteId}: skip (${status})`)
    continue
  }
  console.log(`Site: ${json.name} (${siteId})`)
  console.log(`  custom_domain: ${json.custom_domain || '(none)'}`)
  console.log(`  aliases: ${(json.domain_aliases || []).join(', ') || '(none)'}`)

  for (const hostname of HOSTS) {
    const del = await netlify(token, `/sites/${siteId}/domains/${hostname}`, {
      method: 'DELETE',
    })
    if (del.status === 204 || del.status === 200) {
      console.log(`  Removed ${hostname}`)
    } else if (del.status === 404) {
      console.log(`  ${hostname} not on site`)
    } else {
      console.log(`  ${hostname}: ${del.status}`, del.json)
    }
  }

  if (json.custom_domain && HOSTS.includes(json.custom_domain)) {
    const upd = await netlify(token, `/sites/${siteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ custom_domain: null }),
    })
    console.log(`  Cleared custom_domain: ${upd.status}`)
  }
}

console.log('Done.')
