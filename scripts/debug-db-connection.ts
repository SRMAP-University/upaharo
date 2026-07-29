import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const url = process.env.DATABASE_URL || ''
  const host = url.match(/@([^/:?]+)/)?.[1] || 'unknown'

  const stores = await prisma.store.findMany({
    select: { id: true, slug: true, name: true, isActive: true },
    orderBy: { slug: 'asc' },
  })

  for (const store of stores) {
    const [products, categories] = await Promise.all([
      prisma.product.count({ where: { storeId: store.id } }),
      prisma.category.count({ where: { storeId: store.id, type: 'PRODUCT' } }),
    ])
    console.log({ slug: store.slug, id: store.id, isActive: store.isActive, products, productCategories: categories })
  }

  console.log('\nDATABASE host:', host)
}

main().finally(async () => prisma.$disconnect())
