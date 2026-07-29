import { NextRequest, NextResponse } from 'next/server'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { findManyProductCardsCompat } from '@/lib/product-db'
import { getOrSetJson, REDIS_KEYS } from '@/lib/redis'
import { resolveStoreContext } from '@/lib/store-context'

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

export async function GET(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { slug, store } = storeContext
    const viewedProductIds = unique(
      String(request.nextUrl.searchParams.get('viewedProductIds') || '')
        .split(',')
        .map((value) => value.trim())
    ).slice(0, 20)
    const viewedCategories = unique(
      String(request.nextUrl.searchParams.get('viewedCategories') || '')
        .split(',')
        .map((value) => value.trim())
    ).slice(0, 20)

    if (viewedProductIds.length === 0 && viewedCategories.length === 0) {
      return NextResponse.json({
        category: null,
        title: 'Recommended Products',
        products: [],
      })
    }

    const cacheKey = REDIS_KEYS.HOME_RECOMMENDATIONS(
      slug,
      JSON.stringify({
        productIds: viewedProductIds,
        categories: viewedCategories,
      })
    )

    const payload = await getOrSetJson(cacheKey, 120, async () => {
      const viewedProducts =
        viewedProductIds.length > 0
          ? await findManyProductCardsCompat({
              where: {
                storeId: store.id,
                id: { in: viewedProductIds },
                isAvailable: true,
                NOT: {
                  tags: {
                    has: ARCHIVED_PRODUCT_TAG,
                  },
                },
              },
            })
          : []

      if (viewedProducts.length === 0 && viewedCategories.length === 0) {
        return {
          category: null,
          title: 'Recommended Products',
          products: [],
        }
      }

      const categoryWeights = viewedCategories.reduce<Map<string, number>>((acc, category, index) => {
        const weight = viewedCategories.length - index + 2
        acc.set(category, (acc.get(category) || 0) + weight)
        return acc
      }, new Map<string, number>())

      viewedProductIds.forEach((productId, index) => {
        const product = viewedProducts.find((item) => item.id === productId)
        if (!product?.category) return

        const weight = viewedProductIds.length - index
        categoryWeights.set(product.category, (categoryWeights.get(product.category) || 0) + weight)
      })

      const dominantCategory =
        [...categoryWeights.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ||
        viewedProducts[0]?.category ||
        viewedCategories[0]

      const categoryProducts = await findManyProductCardsCompat({
        where: {
          storeId: store.id,
          category: dominantCategory,
          isAvailable: true,
          id: { notIn: viewedProductIds },
          NOT: {
            tags: {
              has: ARCHIVED_PRODUCT_TAG,
            },
          },
        },
        orderBy: [{ discount: 'desc' }, { createdAt: 'desc' }],
        take: 4,
      })

      const fallbackProducts = await findManyProductCardsCompat({
        where: {
          storeId: store.id,
          isAvailable: true,
          category: { not: dominantCategory },
          id: { notIn: [...viewedProductIds, ...categoryProducts.map((item) => item.id)] },
          NOT: {
            tags: {
              has: ARCHIVED_PRODUCT_TAG,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.max(0, 6 - categoryProducts.length),
      })

      return {
        category: dominantCategory,
        title: `More in ${dominantCategory}`,
        products: [...categoryProducts, ...fallbackProducts].slice(0, 6),
      }
    })

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('Error fetching home recommendations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch home recommendations' },
      { status: 500 }
    )
  }
}
