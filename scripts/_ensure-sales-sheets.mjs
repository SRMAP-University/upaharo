import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  // Inventory → Custom sales sheets (festival / season profit calculations).
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SalesSheet" (
      "id" TEXT NOT NULL,
      "storeId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "note" TEXT NOT NULL DEFAULT '',
      "data" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "SalesSheet_pkey" PRIMARY KEY ("id")
    )
  `)
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "SalesSheet_storeId_updatedAt_idx" ON "SalesSheet"("storeId", "updatedAt")`
  )
  console.log('sales sheets table ready')
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
