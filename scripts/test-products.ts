import { prisma } from '../lib/prisma'
import { findManyProductCardsCompat } from '../lib/product-db'

async function main() {
  const store = await prisma.store.findFirst({ where: { slug: 'gifts' } })
  if (!store) throw new Error('store missing')
  const products = await findManyProductCardsCompat({
    where: { storeId: store.id, isAvailable: true },
    take: 2,
  })
  console.log(products.length, products[0]?.name)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
