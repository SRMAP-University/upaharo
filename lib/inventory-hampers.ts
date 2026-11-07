/**
 * Hampers: one product made of several others. Its cost is its items' cost
 * plus packaging, and selling one uses up its items' stock (see lib/inventory).
 */
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { parseBundle, type BundleItem } from '@/lib/inventory'

export const HAMPER_TAG = 'inventory-hamper'
export const DEFAULT_HAMPER_CATEGORY = 'Gift Hampers'
const MAX_ITEMS = 30

const money = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN
}

export type HamperData = {
  name: string
  description: string
  category: string
  image: string
  price: number
  packagingCost: number | null
  isAvailable: boolean
  bundleItems: BundleItem[]
}

/**
 * Checks a hamper form: { name, description?, category?, image?, price,
 * packagingCost?, sellOnline?, items: [{ productId, quantity }] }. Items must
 * be live products of this store and not hampers themselves.
 */
export async function readHamperInput(
  storeId: string,
  body: Record<string, unknown>,
  selfId?: string
): Promise<{ data: HamperData } | { error: string }> {
  const name = String(body.name || '').trim().slice(0, 200)
  if (!name) return { error: 'Give the hamper a name' }
  const price = money(body.price)
  if (price === null || Number.isNaN(price) || price <= 0) return { error: 'Enter the hamper’s selling price' }
  const packagingCost = money(body.packagingCost)
  if (Number.isNaN(packagingCost)) return { error: 'Packaging cost must be 0 or more' }

  // Merge repeats of the same product.
  const merged = new Map<string, number>()
  for (const item of parseBundle(body.items) || []) {
    merged.set(item.productId, (merged.get(item.productId) || 0) + item.quantity)
  }
  const items = [...merged].map(([productId, quantity]) => ({ productId, quantity: Math.min(quantity, 999) }))
  if (items.length > MAX_ITEMS) return { error: `A hamper can have up to ${MAX_ITEMS} different products` }
  if (items.reduce((sum, i) => sum + i.quantity, 0) < 2) return { error: 'Add at least two products to the hamper' }
  if (selfId && merged.has(selfId)) return { error: 'A hamper can’t contain itself' }

  const products = await prisma.product.findMany({
    where: { storeId, id: { in: items.map((i) => i.productId) } },
    select: { id: true, name: true, image: true, tags: true, bundleItems: true },
  })
  const byId = new Map(products.map((p) => [p.id, p]))
  for (const item of items) {
    const product = byId.get(item.productId)
    if (!product || product.tags.includes(ARCHIVED_PRODUCT_TAG)) return { error: 'One of the products is no longer available' }
    if (parseBundle(product.bundleItems)) return { error: `${product.name} is a hamper itself, so it can’t go inside another one` }
  }

  const listed = items.map((i) => `${i.quantity} × ${byId.get(i.productId)!.name}`).join(', ')
  const image = String(body.image || '').trim() || products.find((p) => p.image)?.image || ''
  return {
    data: {
      name,
      description: String(body.description || '').trim().slice(0, 5000) || `Includes: ${listed}.`,
      category: String(body.category || '').trim().slice(0, 120) || DEFAULT_HAMPER_CATEGORY,
      image,
      price,
      packagingCost,
      isAvailable: body.sellOnline === true,
      bundleItems: items,
    },
  }
}
