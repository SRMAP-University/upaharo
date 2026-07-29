import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const stores = await prisma.store.findMany({ select: { id: true, slug: true, name: true } })

  for (const store of stores) {
    const count = await prisma.order.count({ where: { storeId: store.id } })
    const recent = await prisma.order.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        total: true,
        createdAt: true,
      },
    })
    console.log({ store: store.slug, count, recent })
  }

  const allRecent = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      orderNumber: true,
      storeId: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      total: true,
      createdAt: true,
    },
  })
  console.log('\nLatest 10 orders (all stores):', allRecent)
}

main().finally(async () => prisma.$disconnect())
