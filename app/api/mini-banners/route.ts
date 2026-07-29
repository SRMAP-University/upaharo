import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrSetJson, REDIS_KEYS } from '@/lib/redis'
import { resolveStoreContext } from '@/lib/store-context'
import { storeAwareJsonHeaders } from '@/lib/store-cache-headers'

/** Public list of active mini banners for the app's home row. */
export async function GET(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { slug, store } = storeContext
    const miniBanners = await getOrSetJson(REDIS_KEYS.HOME_MINI_BANNERS(slug), 300, async () => {
      const banners = await prisma.miniBanner.findMany({
        where: { storeId: store.id, isActive: true },
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        take: 12,
        select: {
          id: true,
          title: true,
          image: true,
          linkType: true,
          linkId: true,
          order: true,
          isActive: true,
        },
      })

      const productIds = banners
        .filter((banner) => banner.linkType === 'PRODUCT' && banner.linkId)
        .map((banner) => banner.linkId!)
      const categoryIds = banners
        .filter((banner) => banner.linkType === 'CATEGORY' && banner.linkId)
        .map((banner) => banner.linkId!)
      const [products, categories] = await Promise.all([
        productIds.length
          ? prisma.product.findMany({
              where: { id: { in: productIds }, storeId: store.id },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
        categoryIds.length
          ? prisma.category.findMany({
              where: { id: { in: categoryIds }, storeId: store.id },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
      ])
      const labels = new Map<string, string>([
        ...products.map(
          (product): [string, string] => [`PRODUCT:${product.id}`, product.name]
        ),
        ...categories.map(
          (category): [string, string] => [`CATEGORY:${category.id}`, category.name]
        ),
      ])

      return banners.map(({ order: _order, isActive: _isActive, ...banner }) => {
        const linkType = banner.linkType === 'PRODUCT' || banner.linkType === 'CATEGORY'
          ? banner.linkType
          : 'NONE'
        const linkLabel = banner.linkId ? labels.get(`${linkType}:${banner.linkId}`) ?? null : null
        return {
          ...banner,
          ...(linkType !== 'NONE' && linkLabel === null
            ? { linkType: 'NONE', linkId: null }
            : { linkType }),
          linkLabel,
        }
      })
    })

    return NextResponse.json({ miniBanners }, { headers: storeAwareJsonHeaders() })
  } catch (error) {
    console.error('Error listing mini banners:', error)
    return NextResponse.json({ miniBanners: [] }, { status: 200 })
  }
}
