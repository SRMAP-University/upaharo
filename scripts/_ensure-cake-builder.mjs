import { PrismaClient } from '@prisma/client'

// Build Your Own Cake: the order-line picks column and the per-store options
// table. Safe to run on every deploy.
const prisma = new PrismaClient()

try {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "customization" JSONB`
  )
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CakeBuilderSettings" (
      "id" TEXT NOT NULL,
      "storeId" TEXT NOT NULL,
      "config" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "CakeBuilderSettings_pkey" PRIMARY KEY ("id")
    )
  `)
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "CakeBuilderSettings_storeId_key" ON "CakeBuilderSettings"("storeId")`
  )
  console.log('cake builder columns ready')
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
