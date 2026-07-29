import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  try {
    const stores = await prisma.store.findMany({
      select: { id: true, slug: true, name: true, isActive: true },
    })
    console.log('Stores:', JSON.stringify(stores, null, 2))

    for (const store of stores) {
      const count = await prisma.banner.count({ where: { storeId: store.id } })
      const active = await prisma.banner.count({
        where: { storeId: store.id, isActive: true },
      })
      console.log(`${store.slug} (${store.id}): ${count} total, ${active} active`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
