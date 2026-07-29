import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  try {
    for (const storeId of ['store_grocery', 'store_gifts']) {
      const banners = await prisma.banner.findMany({
        where: { storeId },
        select: { id: true, title: true, bgColor: true, isActive: true, order: true },
        orderBy: { order: 'asc' },
      })
      console.log(`\n${storeId}:`, JSON.stringify(banners, null, 2))
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
