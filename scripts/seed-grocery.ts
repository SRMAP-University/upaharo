/**
 * Seed Upaharo Grocery store from scraped rasanmart data.
 *
 * Usage: npx tsx --env-file=.env.local scripts/seed-grocery.ts
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const prisma = new PrismaClient()

const DATA_PATH = resolve(process.cwd(), 'data/rasanmart-products.json')
const PLACEHOLDER_IMAGE = 'https://rasanmart.com/images/logo.png'
const BATCH_SIZE = 100

type ScrapedProduct = {
  id: string
  name: string
  price: string | null
  original_price: string | null
  image_url: string | null
  product_url: string | null
  in_stock: boolean
  category_id: string | null
  category_name: string | null
  category_url: string | null
}

function parsePrice(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Number.parseFloat(value.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function computeDiscount(price: number, originalPrice: number | null): number {
  if (!originalPrice || originalPrice <= price) return 0
  return Math.round(((originalPrice - price) / originalPrice) * 1000) / 10
}

function pickCategoryImages(products: ScrapedProduct[]): Map<string, string> {
  const images = new Map<string, string>()
  for (const product of products) {
    const category = product.category_name?.trim()
    const image = product.image_url?.trim()
    if (!category || !image || images.has(category)) continue
    images.set(category, image)
  }
  return images
}

async function main() {
  console.log('Loading scraped products...')
  const raw = readFileSync(DATA_PATH, 'utf8')
  const products = JSON.parse(raw) as ScrapedProduct[]
  console.log(`Loaded ${products.length} scraped products`)

  const groceryStore = await prisma.store.findUnique({ where: { slug: 'grocery' } })
  if (!groceryStore) {
    throw new Error('Grocery store not found. Run prisma/seed.ts first to create stores.')
  }

  const categoryNames = [...new Set(products.map((p) => p.category_name?.trim()).filter(Boolean))] as string[]
  const categoryImages = pickCategoryImages(products)

  console.log(`Clearing existing grocery catalog (${categoryNames.length} categories)...`)

  await prisma.recommendationRule.deleteMany({ where: { storeId: groceryStore.id } })
  await prisma.productViewEvent.deleteMany({ where: { storeId: groceryStore.id } })
  await prisma.wishlistItem.deleteMany({
    where: { product: { storeId: groceryStore.id } },
  })

  const existingProducts = await prisma.product.findMany({
    where: { storeId: groceryStore.id },
    select: { id: true },
  })
  const productIds = existingProducts.map((p) => p.id)

  if (productIds.length > 0) {
    await prisma.orderItem.deleteMany({ where: { productId: { in: productIds } } })
    await prisma.product.deleteMany({ where: { storeId: groceryStore.id } })
  }

  await prisma.category.deleteMany({
    where: { storeId: groceryStore.id, type: 'PRODUCT' },
  })

  console.log('Creating categories...')
  for (const name of categoryNames.sort()) {
    await prisma.category.create({
      data: {
        storeId: groceryStore.id,
        name,
        image: categoryImages.get(name) ?? PLACEHOLDER_IMAGE,
        type: 'PRODUCT',
        isActive: true,
      },
    })
  }
  console.log(`Created ${categoryNames.length} categories`)

  console.log('Creating products...')
  let created = 0
  let skipped = 0

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE)
    const rows = []

    for (const item of batch) {
      const name = item.name?.trim()
      const category = item.category_name?.trim()
      const price = parsePrice(item.price)

      if (!name || !category || price <= 0) {
        skipped += 1
        continue
      }

      const originalPrice = item.original_price ? parsePrice(item.original_price) : null
      const image = item.image_url?.trim() || categoryImages.get(category) || PLACEHOLDER_IMAGE

      rows.push({
        storeId: groceryStore.id,
        name,
        miniDescription: name,
        description: name,
        category,
        price,
        image,
        images: [] as string[],
        variants: [] as object[],
        isAvailable: item.in_stock !== false,
        isVeg: true,
        prepTime: 15,
        tags: [] as string[],
        discount: computeDiscount(price, originalPrice),
      })
    }

    if (rows.length === 0) continue

    const result = await prisma.product.createMany({ data: rows })
    created += result.count
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: +${result.count} (total ${created})`)
  }

  const finalCategoryCount = await prisma.category.count({
    where: { storeId: groceryStore.id, type: 'PRODUCT' },
  })
  const finalProductCount = await prisma.product.count({
    where: { storeId: groceryStore.id },
  })

  console.log('\nGrocery seed complete')
  console.log(`Categories: ${finalCategoryCount}`)
  console.log(`Products:   ${finalProductCount}`)
  console.log(`Skipped:    ${skipped}`)
}

main()
  .catch((error) => {
    console.error('Grocery seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
