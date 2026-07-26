/**
 * Full Postgres (Prisma) data backup → Cloudflare R2.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backup-to-r2.ts
 *
 * Optional env:
 *   R2_BACKUP_BUCKET_NAME   (default: upaharo-backups)
 *   R2_BACKUP_PREFIX        (default: backups)
 *   R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
 *   (or reuse R2_BUCKET_URL + keys from product uploads)
 */
import { createGzip } from 'zlib'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { createWriteStream, promises as fs } from 'fs'
import path from 'path'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { PrismaClient } from '@prisma/client'

const ROOT = path.resolve(__dirname, '..')
const LOCAL_OUT = path.join(ROOT, '.backups')

type TableExport = {
  model: string
  file: string
  rows: number
  bytes: number
}

function resolveR2() {
  const bucketUrl = process.env.R2_BUCKET_URL || ''
  let endpoint = process.env.R2_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT || ''
  let defaultBucket = process.env.R2_BUCKET_NAME || ''

  if (bucketUrl) {
    try {
      const u = new URL(bucketUrl)
      endpoint = endpoint || u.origin
      defaultBucket = defaultBucket || u.pathname.split('/').filter(Boolean)[0] || ''
    } catch {
      // ignore
    }
  }

  const bucket =
    process.env.R2_BACKUP_BUCKET_NAME ||
    process.env.R2_BACKUP_BUCKET ||
    'upaharo-backups'

  const accessKeyId =
    process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || ''
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || ''

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing R2 credentials. Set R2_ENDPOINT (or R2_BUCKET_URL), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.'
    )
  }

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    prefix: (process.env.R2_BACKUP_PREFIX || 'backups').replace(/^\/+|\/+$/g, ''),
  }
}

async function gzipJsonToFile(filePath: string, data: unknown): Promise<number> {
  const json = JSON.stringify(data)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const gzip = createGzip({ level: 9 })
  const source = Readable.from([json])
  const dest = createWriteStream(filePath)
  await pipeline(source, gzip, dest)
  const stat = await fs.stat(filePath)
  return stat.size
}

async function uploadFile(
  client: S3Client,
  bucket: string,
  key: string,
  filePath: string,
  contentType: string
) {
  const body = await fs.readFile(filePath)
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )
  return body.length
}

async function exportAll(prisma: PrismaClient) {
  // Keep order friendly for restore docs; each table is independent JSON.
  return {
    User: await prisma.user.findMany(),
    Account: await prisma.account.findMany(),
    Session: await prisma.session.findMany(),
    VerificationToken: await prisma.verificationToken.findMany(),
    Address: await prisma.address.findMany(),
    Banner: await prisma.banner.findMany(),
    Category: await prisma.category.findMany(),
    Product: await prisma.product.findMany(),
    Coupon: await prisma.coupon.findMany(),
    Seller: await prisma.seller.findMany(),
    GiftWrap: await prisma.giftWrap.findMany(),
    Occasion: await prisma.occasion.findMany(),
    GiftRecipient: await prisma.giftRecipient.findMany(),
    DeliveryPartner: await prisma.deliveryPartner.findMany(),
    Order: await prisma.order.findMany(),
    OrderItem: await prisma.orderItem.findMany(),
    AppSettings: await prisma.appSettings.findMany(),
    ProductViewEvent: await prisma.productViewEvent.findMany(),
    RecommendationRule: await prisma.recommendationRule.findMany(),
    DeviceToken: await prisma.deviceToken.findMany(),
    AppNotification: await prisma.appNotification.findMany(),
  } as Record<string, unknown[]>
}

async function main() {
  const started = Date.now()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const r2 = resolveR2()
  const runDir = path.join(LOCAL_OUT, stamp)
  const dataDir = path.join(runDir, 'data')

  console.log('→ Connecting to database…')
  const prisma = new PrismaClient()

  console.log('→ Exporting all tables…')
  const tables = await exportAll(prisma)
  await prisma.$disconnect()

  const exports: TableExport[] = []
  let totalRows = 0

  await fs.mkdir(dataDir, { recursive: true })

  for (const [model, rows] of Object.entries(tables)) {
    const file = path.join(dataDir, `${model}.json.gz`)
    const bytes = await gzipJsonToFile(file, rows)
    exports.push({ model, file: `data/${model}.json.gz`, rows: rows.length, bytes })
    totalRows += rows.length
    console.log(`  • ${model}: ${rows.length} rows (${(bytes / 1024).toFixed(1)} KB gz)`)
  }

  // Schema snapshot for restore reference
  const schemaSrc = path.join(ROOT, 'prisma', 'schema.prisma')
  const schemaDest = path.join(runDir, 'schema.prisma')
  await fs.copyFile(schemaSrc, schemaDest)

  const manifest = {
    createdAt: new Date().toISOString(),
    project: 'upaharo',
    source: 'neon-postgres',
    format: 'prisma-json-gzip-v1',
    totalRows,
    tables: exports.map(({ model, file, rows, bytes }) => ({ model, file, rows, bytes })),
    notes: [
      'Each data/*.json.gz file is a JSON array of rows for that Prisma model.',
      'Passwords/tokens are included — keep this bucket private.',
      'Restore: gunzip + prisma createMany / custom importer (not automated here).',
    ],
  }

  const manifestPath = path.join(runDir, 'manifest.json')
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

  // Single combined archive for easy download
  const fullPath = path.join(runDir, 'full-export.json.gz')
  const fullBytes = await gzipJsonToFile(fullPath, {
    manifest,
    data: tables,
  })
  console.log(`  • full-export.json.gz: ${(fullBytes / 1024 / 1024).toFixed(2)} MB`)

  console.log(`→ Uploading to R2 bucket "${r2.bucket}"…`)
  const client = new S3Client({
    region: 'auto',
    endpoint: r2.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
    },
  })

  const baseKey = `${r2.prefix}/${stamp}`
  const uploaded: { key: string; bytes: number }[] = []

  const uploadOne = async (localPath: string, key: string, type: string) => {
    const bytes = await uploadFile(client, r2.bucket, key, localPath, type)
    uploaded.push({ key, bytes })
    console.log(`  ↑ ${key} (${(bytes / 1024).toFixed(1)} KB)`)
  }

  await uploadOne(manifestPath, `${baseKey}/manifest.json`, 'application/json')
  await uploadOne(schemaDest, `${baseKey}/schema.prisma`, 'text/plain')
  await uploadOne(fullPath, `${baseKey}/full-export.json.gz`, 'application/gzip')

  for (const item of exports) {
    await uploadOne(
      path.join(runDir, item.file),
      `${baseKey}/${item.file}`,
      'application/gzip'
    )
  }

  const summary = {
    ok: true,
    bucket: r2.bucket,
    endpoint: r2.endpoint,
    prefix: baseKey,
    totalRows,
    files: uploaded.length,
    elapsedMs: Date.now() - started,
    localPath: runDir,
    r2Uri: `r2://${r2.bucket}/${baseKey}/`,
  }

  const summaryPath = path.join(runDir, 'upload-summary.json')
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8')
  await uploadOne(summaryPath, `${baseKey}/upload-summary.json`, 'application/json')

  console.log('\n✓ Backup complete')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((err) => {
  console.error('Backup failed:', err)
  process.exit(1)
})
