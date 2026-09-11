import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "OrderSource" AS ENUM ('UPAHARO', 'OFFLINE');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "source" "OrderSource" NOT NULL DEFAULT 'UPAHARO'`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "offlineChannel" TEXT`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "offlineNote" TEXT`
  )
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Order_storeId_source_idx" ON "Order"("storeId", "source")`
  )
  console.log('offline order columns ready')
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
