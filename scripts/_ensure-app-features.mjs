import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'

function loadEnv(path) {
  try {
    const text = readFileSync(path, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!m) continue
      let v = m[2].trim()
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      if (!process.env[m[1]]) process.env[m[1]] = v
    }
  } catch {
    // optional local env file
  }
}

loadEnv('.env.local')
loadEnv('.env')

// DDL through the transaction pooler often fails; prefer the direct URL.
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

const prisma = new PrismaClient()

try {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AppFeature" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "platforms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "minRuntime" INTEGER NOT NULL DEFAULT 1,
      "minAppVersion" TEXT,
      "maxAppVersion" TEXT,
      "startsAt" TIMESTAMP(3),
      "endsAt" TIMESTAMP(3),
      "priority" INTEGER NOT NULL DEFAULT 0,
      "config" JSONB NOT NULL DEFAULT '{}',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "AppFeature_storeId_key_key" ON "AppFeature"("storeId", "key")`
  )
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "AppFeature_storeId_idx" ON "AppFeature"("storeId")`
  )
  console.log('AppFeature table ready')
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
