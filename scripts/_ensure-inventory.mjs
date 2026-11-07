import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stockCountedAt" TIMESTAMP(3)`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "costPrice" DOUBLE PRECISION`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "packagingCost" DOUBLE PRECISION`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bundleItems" JSONB`)
  // Inventory's own view of orders: switched off / deleted there, corrected quantity and price.
  await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "inventoryExcluded" BOOLEAN NOT NULL DEFAULT false`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "inventoryRemovedAt" TIMESTAMP(3)`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "inventoryQty" INTEGER`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "inventoryPrice" DOUBLE PRECISION`)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdminPin" (
      "id" TEXT NOT NULL,
      "hash" TEXT NOT NULL,
      "salt" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AdminPin_pkey" PRIMARY KEY ("id")
    )
  `)
  console.log('inventory columns ready')
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
