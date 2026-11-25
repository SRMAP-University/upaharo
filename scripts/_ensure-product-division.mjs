import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Upaharo Gifts / Upaharo Cakes: which inventory each product belongs to.
// When the column is first added, products in cake categories start in Cakes;
// after that it is only changed by admins (product editor or bulk action).
const CAKE_CATEGORY = 'cake|pastr|cupcake|bakery|brownie|cookie|dessert'

try {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'Product' AND column_name = 'division' LIMIT 1`
  )
  if (Array.isArray(existing) && existing.length) {
    console.log('product division column ready')
  } else {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "division" TEXT NOT NULL DEFAULT 'gifts'`)
    const cakes = await prisma.$executeRawUnsafe(
      `UPDATE "Product" SET "division" = 'cakes' WHERE "category" ~* '${CAKE_CATEGORY}'`
    )
    console.log(`product division column added; ${cakes} cake products moved to Upaharo Cakes`)
  }
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Product_storeId_division_idx" ON "Product"("storeId", "division")`
  )
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
