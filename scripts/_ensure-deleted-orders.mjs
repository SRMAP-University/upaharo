import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  // Copies of orders deleted from admin Orders, kept so a mistake can be undone by hand.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DeletedOrder" (
      "id" TEXT NOT NULL,
      "storeId" TEXT NOT NULL,
      "orderNumber" TEXT NOT NULL,
      "data" JSONB NOT NULL,
      "deletedBy" TEXT,
      "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DeletedOrder_pkey" PRIMARY KEY ("id")
    )
  `)
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "DeletedOrder_storeId_deletedAt_idx" ON "DeletedOrder"("storeId", "deletedAt")`
  )
  console.log('deleted orders table ready')
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
