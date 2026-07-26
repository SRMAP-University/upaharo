import { spawnSync } from 'child_process'

const SITE_ID = 'a8a24e22-d4a5-4de5-8bc6-fa304053f28c'

function api(method, data) {
  const result = spawnSync(
    'npx',
    ['netlify', 'api', method, '--data', JSON.stringify(data)],
    { encoding: 'utf8', shell: true }
  )
  const out = (result.stdout || '').trim()
  if (result.status !== 0) {
    console.error(method, 'FAIL', result.stderr || out)
    return null
  }
  try {
    return JSON.parse(out)
  } catch {
    console.error(method, 'BAD JSON', out.slice(0, 400))
    return null
  }
}

const updated = api('updateSite', {
  site_id: SITE_ID,
  body: {
    custom_domain: 'www.upaharo.com',
    domain_aliases: ['upaharo.com'],
    force_ssl: true,
  },
})

if (updated) {
  console.log('custom_domain:', updated.custom_domain)
  console.log('domain_aliases:', updated.domain_aliases)
  console.log('url:', updated.ssl_url || updated.url)
} else {
  process.exit(1)
}
