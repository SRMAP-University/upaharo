import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { getOrSetJson, REDIS_KEYS } from '@/lib/redis'
import { resolveStoreContext } from '@/lib/store-context'

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { slug, store } = storeContext
    const viewed = new URL(request.url).searchParams.get('viewedProductIds')
    const viewedProductIds = viewed
      ? viewed
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : []

    const viewedKey = viewedProductIds.slice(0, 20).join(',') || 'none'
    const recommendations = await getOrSetJson(
      REDIS_KEYS.PRODUCT_RECOMMENDATIONS(slug, id, viewedKey),
      120,
      async () => {
        const source = await prisma.product.findFirst({
          where: {
            id,
            storeId: store.id,
            isAvailable: true,
            NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
          },
          select: { category: true },
        })
        if (!source) return { buyTogether: [], addons: [], related: [] }
        const products = await prisma.product.findMany({
          where: {
            storeId: store.id,
            id: { notIn: [id, ...viewedProductIds] },
            isAvailable: true,
            NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
          },
          select: {
            id: true, name: true, price: true, image: true, category: true,
            discount: true, isVeg: true, isAvailable: true,
          },
          orderBy: [{ discount: 'desc' }, { createdAt: 'desc' }],
          take: 24,
        })
        const related = products.filter((product) => product.category === source.category).slice(0, 8)
        const remainder = products.filter((product) => product.category !== source.category)
        return {
          buyTogether: remainder.slice(0, 3),
          addons: remainder.slice(3, 9),
          related,
        }
      }
    )

    return NextResponse.json(recommendations)
  } catch (error) {
    console.error('Error fetching product recommendations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    )
  }
}
