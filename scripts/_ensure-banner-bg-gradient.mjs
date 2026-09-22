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
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Banner" ADD COLUMN IF NOT EXISTS "bgGradient" JSONB`
  )
  console.log('Banner.bgGradient column ready')
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
