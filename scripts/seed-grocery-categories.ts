/**
 * Seed / refresh Upaharo Grocery PRODUCT categories from rasanmart.com.
 * Does not modify products.
 *
 * Usage: npx tsx --env-file=.env.local scripts/seed-grocery-categories.ts
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CATEGORY_ICON_KEYS, CATEGORY_WASH_PRESETS } from '../lib/category-style'

const prisma = new PrismaClient()
const RASANMART_BASE = 'https://rasanmart.com'
const DATA_PATH = resolve(process.cwd(), 'data/rasanmart-products.json')
const PLACEHOLDER_IMAGE = `${RASANMART_BASE}/images/logo.png`

type ScrapedProduct = {
  category_id: string | null
  category_name: string | null
  image_url: string | null
}

type CategorySeed = {
  id: string
  name: string
  image: string
}

function normalizeImage(src: string): string {
  if (src.startsWith('http')) return src
  if (src.startsWith('/')) return `${RASANMART_BASE}${src}`
  return `${RASANMART_BASE}/${src.replace(/^\/+/, '')}`
}

async function fetchRasanmartCategoryCatalog(): Promise<Map<string, CategorySeed>> {
  const response = await fetch(RASANMART_BASE, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch rasanmart homepage (${response.status})`)
  }

  const html = await response.text()
  const categories = new Map<string, CategorySeed>()

  const blockPattern =
    /href="\/product-category\/(\d+)"[^>]*>\s*<img class="category-image" src="([^"]+)"[\s\S]*?<a href="\/product-category\/\1">([^<]+)<\/a>/gi

  for (const match of html.matchAll(blockPattern)) {
    const id = match[1]
    const name = match[3].replace(/&amp;/g, '&').trim()
    categories.set(id, {
      id,
      name,
      image: normalizeImage(match[2]),
    })
  }

  if (categories.size === 0) {
    const linkPattern = /href="\/product-category\/(\d+)">([^<]+)<\/a>/gi
    for (const match of html.matchAll(linkPattern)) {
      const id = match[1]
      const name = match[2].replace(/&amp;/g, '&').trim()
      if (name === 'View All Products' || categories.has(id)) continue
      categories.set(id, { id, name, image: PLACEHOLDER_IMAGE })
    }
  }

  return categories
}

function fallbackFromProducts(products: ScrapedProduct[]): Map<string, CategorySeed> {
  const map = new Map<string, CategorySeed>()

  for (const product of products) {
    const id = product.category_id?.trim()
    const name = product.category_name?.trim()
    if (!id || !name || map.has(id)) continue

    map.set(id, {
      id,
      name,
      image: product.image_url?.trim()
        ? normalizeImage(product.image_url.trim())
        : PLACEHOLDER_IMAGE,
    })
  }

  return map
}

function mergeCategoryCatalog(
  remote: Map<string, CategorySeed>,
  fallback: Map<string, CategorySeed>
): CategorySeed[] {
  const merged = new Map<string, CategorySeed>(remote)

  for (const [id, category] of fallback) {
    if (!merged.has(id)) {
      merged.set(id, category)
      continue
    }

    const existing = merged.get(id)!
    if (existing.image === PLACEHOLDER_IMAGE && category.image !== PLACEHOLDER_IMAGE) {
      merged.set(id, { ...existing, image: category.image })
    }
  }

  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name))
}

async function main() {
  console.log('Fetching rasanmart category catalog...')
  const remoteCategories = await fetchRasanmartCategoryCatalog()
  console.log(`Found ${remoteCategories.size} categories on rasanmart homepage`)

  const products = JSON.parse(readFileSync(DATA_PATH, 'utf8')) as ScrapedProduct[]
  const categories = mergeCategoryCatalog(remoteCategories, fallbackFromProducts(products))
  console.log(`Seeding ${categories.length} grocery categories`)

  const groceryStore = await prisma.store.findUnique({ where: { slug: 'grocery' } })
  if (!groceryStore) {
    throw new Error('Grocery store not found. Run prisma/seed.ts first.')
  }

  const existing = await prisma.category.findMany({
    where: { storeId: groceryStore.id, type: 'PRODUCT' },
    select: { id: true, name: true },
  })
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()))
  const nextNames = new Set(categories.map((c) => c.name.toLowerCase()))

  const stale = existing.filter((c) => !nextNames.has(c.name.toLowerCase()))
  if (stale.length > 0) {
    await prisma.category.deleteMany({
      where: { id: { in: stale.map((c) => c.id) } },
    })
    console.log(`Removed ${stale.length} stale categories`)
  }

  let created = 0
  let updated = 0

  for (const [index, category] of categories.entries()) {
    const iconName = CATEGORY_ICON_KEYS[index % CATEGORY_ICON_KEYS.length]
    const washColor = CATEGORY_WASH_PRESETS[index % CATEGORY_WASH_PRESETS.length]

    const payload = {
      storeId: groceryStore.id,
      name: category.name,
      image: category.image,
      type: 'PRODUCT' as const,
      isActive: true,
      iconName,
      washColor,
    }

    const result = await prisma.category.upsert({
      where: {
        storeId_name_type: {
          storeId: groceryStore.id,
          name: category.name,
          type: 'PRODUCT',
        },
      },
      create: payload,
      update: {
        image: category.image,
        isActive: true,
        iconName,
        washColor,
      },
    })

    if (existingNames.has(category.name.toLowerCase())) {
      updated += 1
      void result
    } else {
      created += 1
    }
  }

  const total = await prisma.category.count({
    where: { storeId: groceryStore.id, type: 'PRODUCT', isActive: true },
  })

  console.log('\nGrocery categories seeded')
  console.log(`Created: ${created}`)
  console.log(`Updated: ${updated}`)
  console.log(`Active PRODUCT categories: ${total}`)
  console.log('\nSample:')
  for (const category of categories.slice(0, 5)) {
    console.log(`  - ${category.name}: ${category.image}`)
  }
  console.log('\nTip: In admin, switch store to "Upaharo Grocery" to view these categories.')
}

main()
  .catch((error) => {
    console.error('Category seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
