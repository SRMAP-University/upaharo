import { PrismaClient } from '@prisma/client'
import { ARCHIVED_PRODUCT_TAG } from '../lib/product-archive'

const prisma = new PrismaClient()

async function main() {
  const store = await prisma.store.findUnique({ where: { slug: 'grocery' } })
  if (!store) throw new Error('missing grocery store')

  const where = {
    storeId: store.id,
    NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
  }

  const total = await prisma.product.count({ where })
  const page = await prisma.product.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, name: true, category: true },
  })

  console.log({ storeId: store.id, total, sample: page })
}

main().finally(async () => prisma.$disconnect())
