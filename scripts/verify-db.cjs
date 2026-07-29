const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    const [stores, products, users, orders] = await Promise.all([
      prisma.store.count(),
      prisma.product.count(),
      prisma.user.count(),
      prisma.order.count(),
    ])
    console.log(JSON.stringify({ stores, products, users, orders }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main()
