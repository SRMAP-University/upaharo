import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const grocery = await prisma.store.findUnique({ where: { slug: 'grocery' } })
  const gifts = await prisma.store.findUnique({ where: { slug: 'gifts' } })
  if (!grocery || !gifts) throw new Error('stores missing')

  const groceryCategories = await prisma.category.findMany({
    where: { storeId: grocery.id },
    select: { id: true, name: true, type: true, isActive: true },
    orderBy: { name: 'asc' },
  })

  const giftsCategories = await prisma.category.findMany({
    where: { storeId: gifts.id },
    select: { id: true, name: true, type: true, isActive: true },
    orderBy: { name: 'asc' },
  })

  console.log('Grocery categories:', groceryCategories.length)
  console.log('  PRODUCT:', groceryCategories.filter((c) => c.type === 'PRODUCT').length)
  console.log('Gifts categories:', giftsCategories.length)
  console.log('  PRODUCT:', giftsCategories.filter((c) => c.type === 'PRODUCT').length)
}

main().finally(async () => prisma.$disconnect())
