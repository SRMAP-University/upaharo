import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  // Product stats: product opened from a list ("click") and added to cart.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductEvent" (
      "id" TEXT NOT NULL,
      "storeId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "source" TEXT,
      "sessionId" TEXT,
      "userId" TEXT,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
    )
  `)
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductEvent_storeId_productId_createdAt_idx" ON "ProductEvent"("storeId", "productId", "createdAt")`
  )
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductEvent_storeId_type_createdAt_idx" ON "ProductEvent"("storeId", "type", "createdAt")`
  )
  console.log('product events table ready')
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
