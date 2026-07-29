import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const store = await prisma.store.findUnique({ where: { slug: 'grocery' } })
  if (!store) throw new Error('grocery store missing')

  const [categoryCount, productCount] = await Promise.all([
    prisma.category.count({ where: { storeId: store.id, type: 'PRODUCT' } }),
    prisma.product.count({ where: { storeId: store.id } }),
  ])

  const categories = await prisma.category.findMany({
    where: { storeId: store.id, type: 'PRODUCT' },
    select: { name: true, image: true },
    orderBy: { name: 'asc' },
    take: 5,
  })

  const products = await prisma.product.findMany({
    where: { storeId: store.id },
    select: { name: true, category: true, image: true, price: true, discount: true },
    take: 3,
  })

  console.log({ categoryCount, productCount, categories, products })
}

main()
  .finally(async () => prisma.$disconnect())
