import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  // Who cancelled an order (CUSTOMER | ADMIN | SELLER | SYSTEM) and why.
  await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT`)
  console.log('order cancel columns ready')
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
