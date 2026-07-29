import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { resolveStoreContext } from '@/lib/store-context'
import { storeAwareJsonHeaders } from '@/lib/store-cache-headers'

/** Public list of active homepage banners for the storefront / app. */
export async function GET(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { store } = storeContext
    const banners = await prisma.banner.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      take: 12,
      select: {
        id: true,
        title: true,
        subtitle: true,
        image: true,
        link: true,
        bgColor: true,
        order: true,
        productIds: true,
        category: true,
      },
    })

    const withProducts = await Promise.all(
      banners.map(async (banner) => {
        const products = await prisma.product.findMany({
          where: {
            storeId: store.id,
            isAvailable: true,
            NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
            ...(banner.productIds.length > 0
              ? { id: { in: banner.productIds } }
              : banner.category
                ? { category: { equals: banner.category, mode: 'insensitive' } }
                : { id: { in: [] } }),
          },
          select: {
            id: true, name: true, price: true, image: true, category: true,
            discount: true, isAvailable: true, miniDescription: true, variants: true,
          },
          orderBy: banner.productIds.length > 0 ? undefined : { createdAt: 'desc' },
          take: 3,
        })
        const byId = new Map(products.map((product) => [product.id, product]))
        return {
          ...banner,
          products: banner.productIds.length > 0
            ? banner.productIds.map((id) => byId.get(id)).filter(Boolean)
            : products,
        }
      })
    )

    return NextResponse.json({
      banners: withProducts.map(({ productIds: _ids, ...rest }) => rest),
    }, { headers: storeAwareJsonHeaders() })
  } catch (error) {
    console.error('Error listing banners:', error)
    return NextResponse.json({ banners: [] }, { status: 200 })
  }
}
