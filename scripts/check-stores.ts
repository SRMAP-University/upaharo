import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const stores = await prisma.store.findMany({ select: { id: true, slug: true, name: true } })
  for (const store of stores) {
    const counts = await prisma.category.groupBy({
      by: ['type'],
      where: { storeId: store.id },
      _count: true,
    })
    const products = await prisma.product.count({ where: { storeId: store.id } })
    console.log(store.slug, { products, categories: counts })
  }
}

main().finally(async () => prisma.$disconnect())
