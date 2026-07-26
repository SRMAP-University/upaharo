import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'

export type BannerProductCard = {
  id: string
  name: string
  price: number
  image: string
  category: string
  discount: number | null
  isAvailable: boolean
  miniDescription: string | null
}

const productSelect = {
  id: true,
  name: true,
  price: true,
  image: true,
  category: true,
  discount: true,
  isAvailable: true,
  miniDescription: true,
} as const

function mapProduct(p: {
  id: string
  name: string
  price: number
  image: string
  category: string
  discount: number | null
  isAvailable: boolean
  miniDescription: string | null
}): BannerProductCard {
  return {
    id: p.id,
    name: p.name,
    price: Number(p.price),
    image: p.image,
    category: p.category,
    discount: p.discount != null ? Number(p.discount) : null,
    isAvailable: p.isAvailable,
    miniDescription: p.miniDescription,
  }
}

/** Normalize admin payload: max 3 unique product ids. */
export function normalizeBannerProductIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const ids: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const id = item.trim()
    if (!id || ids.includes(id)) continue
    ids.push(id)
    if (ids.length >= 3) break
  }
  return ids
}

export function normalizeBannerCategory(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  return value.length > 0 ? value.slice(0, 80) : null
}

/**
 * Resolve up to 3 products for a banner:
 * 1) explicit productIds (order preserved)
 * 2) else products from category name
 */
export async function resolveBannerProducts(input: {
  productIds?: string[] | null
  category?: string | null
}): Promise<BannerProductCard[]> {
  const productIds = normalizeBannerProductIds(input.productIds ?? [])
  const category = normalizeBannerCategory(input.category)

  if (productIds.length > 0) {
    const rows = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isAvailable: true,
        NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
      },
      select: productSelect,
    })
    const byId = new Map(rows.map((p) => [p.id, mapProduct(p)]))
    return productIds.map((id) => byId.get(id)).filter(Boolean) as BannerProductCard[]
  }

  if (category) {
    const rows = await prisma.product.findMany({
      where: {
        isAvailable: true,
        category: { equals: category, mode: 'insensitive' },
        NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
      },
      select: productSelect,
      orderBy: { createdAt: 'desc' },
      take: 3,
    })
    return rows.map(mapProduct)
  }

  return []
}

export async function attachProductsToBanners<
  T extends { productIds?: string[] | null; category?: string | null },
>(banners: T[]): Promise<Array<T & { products: BannerProductCard[] }>> {
  return Promise.all(
    banners.map(async (banner) => ({
      ...banner,
      products: await resolveBannerProducts({
        productIds: banner.productIds,
        category: banner.category,
      }),
    }))
  )
}
