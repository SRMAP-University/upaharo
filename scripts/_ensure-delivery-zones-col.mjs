import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "deliveryZones" JSONB`
  )
  console.log('deliveryZones column ready')
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
