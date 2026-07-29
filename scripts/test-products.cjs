const { PrismaClient } = require('@prisma/client')
const { findManyProductCardsCompat } = require('../lib/product-db')

async function main() {
  const prisma = new PrismaClient()
  try {
    const store = await prisma.store.findFirst({ where: { slug: 'gifts' } })
    console.log('store', store?.id)
    const products = await findManyProductCardsCompat({
      where: { storeId: store.id, isAvailable: true },
      take: 2,
    })
    console.log('products', products.length, products[0]?.name)
  } catch (e) {
    console.error('ERR', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
