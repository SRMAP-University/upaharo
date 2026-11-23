// One-time: add the "Wedding Gifts" and "Winter Warmers" shop categories to the
// gifts store. They gather matching gifts from across the shop (see
// lib/season-categories.ts), so no product is moved.
//
// Runs on every deploy but acts only once (marker file below), and never adds
// a second wedding or winter category when the shop already has one, active
// or not. To remove one later, turn it off in Admin -> Categories.
import { PrismaClient } from '@prisma/client'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

const MARKER_DIR = '.backups/ensure-markers'
const MARKER = `${MARKER_DIR}/season-categories-2026`

const SEASONS = [
  {
    name: 'Wedding Gifts',
    shortName: 'Wedding',
    match: /wedding|marriage|bibaha|bride|groom/i,
    image: 'https://www.upaharo.com/categories/wedding.png',
    washColor: '#FDECEA',
  },
  {
    name: 'Winter Warmers',
    shortName: 'Winter',
    match: /winter/i,
    image: 'https://www.upaharo.com/categories/winter.png',
    washColor: '#EEF0FB',
  },
]

const prisma = new PrismaClient()
try {
  if (existsSync(MARKER)) {
    console.log('season categories: already added')
  } else {
    const store = await prisma.store.findFirst({ where: { slug: 'gifts' }, select: { id: true } })
    if (!store) throw new Error('gifts store not found')
    const existing = await prisma.category.findMany({
      where: { storeId: store.id, type: 'PRODUCT' },
      select: { name: true },
    })
    for (const season of SEASONS) {
      if (existing.some((category) => season.match.test(category.name))) {
        console.log(`season categories: ${season.name} skipped (the shop already has one)`)
        continue
      }
      await prisma.category.create({
        data: {
          storeId: store.id,
          name: season.name,
          shortName: season.shortName,
          image: season.image,
          type: 'PRODUCT',
          isActive: true,
          washColor: season.washColor,
        },
      })
      console.log(`season categories: added ${season.name}`)
    }
    mkdirSync(MARKER_DIR, { recursive: true })
    writeFileSync(MARKER, `${new Date().toISOString()}\n`)
  }
} catch (error) {
  console.error('season categories:', error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
