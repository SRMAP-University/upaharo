/**
 * Copy all public tables from SOURCE_DATABASE_URL to TARGET_DATABASE_URL.
 * Run after `prisma db push` on the target.
 */
const { Client } = require('pg')

const SOURCE = process.env.SOURCE_DATABASE_URL
const TARGET = process.env.TARGET_DATABASE_URL

const TABLE_ORDER = [
  'Store',
  'User',
  'VerificationToken',
  'BusinessProfile',
  'Seller',
  'Account',
  'Session',
  'Category',
  'Product',
  'Address',
  'GiftRecipient',
  'GiftWrap',
  'Occasion',
  'AppSettings',
  'Banner',
  'MiniBanner',
  'Coupon',
  'DeviceToken',
  'AppNotification',
  'WalletAccount',
  'WalletTransaction',
  'DeliveryPartner',
  'Order',
  'OrderItem',
  'SpinPlay',
  'WishlistItem',
  'ProductViewEvent',
  'RecommendationRule',
]

function pgClient(url) {
  return new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  })
}

async function listTables(client) {
  const { rows } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE '_prisma%'
    ORDER BY table_name
  `)
  return rows.map((row) => row.table_name)
}

async function getColumnTypes(client, table) {
  const { rows } = await client.query(
    `
    SELECT column_name, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
  `,
    [table]
  )
  return new Map(rows.map((row) => [row.column_name, row.udt_name]))
}

function serializeValue(value, udtName) {
  if (value === null || value === undefined) return null
  if (udtName === 'json' || udtName === 'jsonb') {
    if (typeof value === 'string') return value
    return JSON.stringify(value)
  }
  return value
}

async function copyTable(source, target, table) {
  const types = await getColumnTypes(source, table)
  const { rows } = await source.query(`SELECT * FROM "${table}"`)
  if (rows.length === 0) {
    console.log(`  skip ${table} (empty)`)
    return 0
  }

  const columns = Object.keys(rows[0])
  const colList = columns.map((c) => `"${c}"`).join(', ')
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')

  await target.query(`DELETE FROM "${table}"`)

  let copied = 0
  for (const row of rows) {
    const values = columns.map((col) => serializeValue(row[col], types.get(col)))
    await target.query(
      `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`,
      values
    )
    copied += 1
  }

  console.log(`  ${table}: ${copied} rows`)
  return copied
}

async function main() {
  if (!SOURCE || !TARGET) {
    throw new Error('Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL')
  }

  const source = pgClient(SOURCE)
  const target = pgClient(TARGET)
  await source.connect()
  await target.connect()

  try {
    const existing = await listTables(source)
    const ordered = [
      ...TABLE_ORDER.filter((t) => existing.includes(t)),
      ...existing.filter((t) => !TABLE_ORDER.includes(t)),
    ]

    console.log('Resetting target tables…')
    await target.query('SET session_replication_role = replica')
    for (const table of [...ordered].reverse()) {
      await target.query(`DELETE FROM "${table}"`)
    }

    console.log('Copying tables:', ordered.join(', '))
    let total = 0
    for (const table of ordered) {
      total += await copyTable(source, target, table)
    }

    await target.query('SET session_replication_role = DEFAULT')
    console.log(`Done. ${total} rows copied.`)
  } finally {
    await source.end()
    await target.end()
  }
}

main().catch((error) => {
  console.error('Migration failed:', error.message)
  process.exit(1)
})
