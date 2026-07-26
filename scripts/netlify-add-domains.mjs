import fs from 'fs'
import path from 'path'
import os from 'os'

const SITE_ID = 'a8a24e22-d4a5-4de5-8bc6-fa304053f28c'
const hostnames = ['www.upaharo.com', 'upaharo.com']

const configPath = path.join(os.homedir(), '.netlify', 'config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const userId = Object.keys(config.users || {})[0]
const token = config.users?.[userId]?.auth?.token
if (!token) {
  console.error('No Netlify auth token found')
  process.exit(1)
}

for (const hostname of hostnames) {
  const res = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/domains`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hostname }),
  })
  const text = await res.text()
  console.log(hostname, res.status, text.slice(0, 300))
}
