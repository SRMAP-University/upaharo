import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const hidden = await prisma.order.findMany({
    where: {
      storeId: 'store_grocery',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PENDING',
    },
    select: { orderNumber: true, total: true, createdAt: true, status: true },
  })
  console.log('Hidden grocery ONLINE+PENDING orders:', hidden)

  const visible = await prisma.order.findMany({
    where: {
      storeId: 'store_grocery',
      NOT: { AND: [{ paymentMethod: 'ONLINE' }, { paymentStatus: 'PENDING' }] },
    },
    select: { orderNumber: true, total: true, paymentMethod: true, paymentStatus: true },
  })
  console.log('Visible grocery orders in admin:', visible)
}

main().finally(async () => prisma.$disconnect())
