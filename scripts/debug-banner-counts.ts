import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  try {
    const stores = await prisma.store.findMany({ select: { id: true, slug: true } })
    console.log('Stores:', stores)
    for (const store of stores) {
      const [banners, mini] = await Promise.all([
        prisma.banner.count({ where: { storeId: store.id, isActive: true } }),
        prisma.miniBanner.count({ where: { storeId: store.id, isActive: true } }),
      ])
      console.log(`${store.slug}: ${banners} banners, ${mini} mini-banners`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
