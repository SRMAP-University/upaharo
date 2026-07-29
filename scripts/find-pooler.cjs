const { Client } = require('pg')

const password = encodeURIComponent('adarsh@800850')
const ref = 'trbhvvpgnhrjkaqfrqid'
const regions = [
  'ap-southeast-1',
  'ap-south-1',
  'ap-northeast-1',
  'us-east-1',
  'us-west-1',
  'eu-west-1',
  'eu-central-1',
]

async function tryUrl(label, url) {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM "Product"')
    console.log(`OK ${label}`, rows[0])
    return true
  } catch (error) {
    console.log(`FAIL ${label}`, error.message.split('\n')[0])
    return false
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function main() {
  for (const region of regions) {
    for (const aws of ['0', '1']) {
      const host = `aws-${aws}-${region}.pooler.supabase.com`
      const tx = `postgresql://postgres.${ref}:${password}@${host}:6543/postgres?pgbouncer=true`
      if (await tryUrl(`tx ${host}`, tx)) return
      const session = `postgresql://postgres.${ref}:${password}@${host}:5432/postgres`
      if (await tryUrl(`session ${host}`, session)) return
    }
  }
}

main()
