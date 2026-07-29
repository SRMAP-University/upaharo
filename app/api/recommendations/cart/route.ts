import { NextRequest, NextResponse } from 'next/server'
import { findManyProductsCompat } from '@/lib/product-db'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { getOrSetJson, REDIS_KEYS } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { resolveStoreContext } from '@/lib/store-context'

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

export async function GET(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { slug, store } = storeContext
    const { searchParams } = new URL(request.url)
    const productIds = unique(
      String(searchParams.get('productIds') || '')
        .split(',')
        .map((value) => value.trim())
    )
    const viewedProductIds = unique(
      String(searchParams.get('viewedProductIds') || '')
        .split(',')
        .map((value) => value.trim())
    )

    if (productIds.length === 0) {
      return NextResponse.json({
        mode: 'NONE',
        title: 'Recommended for You',
        products: [],
      })
    }

    const scopedCartProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, storeId: store.id },
      select: { id: true },
    })
    if (scopedCartProducts.length !== productIds.length) {
      return NextResponse.json({
        mode: 'NONE',
        title: 'Recommended for You',
        products: [],
      })
    }

    const settings = await prisma.appSettings.findUnique({
      where: { storeId: store.id },
      select: { homepageRecommendationMode: true, homepageRecommendationTitle: true },
    })
    const recommendationMode = String(settings?.homepageRecommendationMode || 'LATEST').toUpperCase()

    if (recommendationMode === 'BEST_OFFER') {
      const bestOffers = await getOrSetJson(
        REDIS_KEYS.CART_RECOMMENDATIONS(slug, productIds.join(','), 'best-offer'),
        120,
        async () =>
          findManyProductsCompat({
            where: {
              storeId: store.id,
              isAvailable: true,
              id: { notIn: productIds },
              NOT: {
                tags: {
                  has: ARCHIVED_PRODUCT_TAG,
                },
              },
            },
            orderBy: [{ discount: 'desc' }, { createdAt: 'desc' }],
            take: 6,
          })
      )

      return NextResponse.json({
        mode: 'BEST_OFFER',
        title: settings?.homepageRecommendationTitle || 'Best Offers',
        products: bestOffers.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          category: item.category,
          discount: item.discount || 0,
          isVeg: item.isVeg,
          isAvailable: item.isAvailable,
        })),
      })
    }

    const products = await getOrSetJson(
      REDIS_KEYS.CART_RECOMMENDATIONS(
        slug,
        productIds.join(','),
        viewedProductIds.slice(0, 20).join(',') || 'none'
      ),
      120,
      async () =>
        findManyProductsCompat({
          where: {
            storeId: store.id,
            isAvailable: true,
            id: { notIn: [...productIds, ...viewedProductIds] },
            NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
          },
          orderBy: [{ discount: 'desc' }, { createdAt: 'desc' }],
          take: 6,
        })
    )

    return NextResponse.json({
      mode: 'RELATED',
      title: settings?.homepageRecommendationTitle || 'Related Products',
      products,
    })
  } catch (error) {
    console.error('Error fetching cart recommendations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cart recommendations' },
      { status: 500 }
    )
  }
}
