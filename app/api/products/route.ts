import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG, sanitizeProductTags } from '@/lib/product-archive'
import { findManyProductCardsCompat, findManyProductsCompat, withProductWriteCompatibility } from '@/lib/product-db'
import { getOrSetJson, REDIS_KEYS } from '@/lib/redis'
import { resolveUserId } from '@/lib/request-auth'
import { recordUserSearch } from '@/lib/search-history'
import { getAppSettings } from '@/lib/app-settings'
import { festiveFirst } from '@/lib/festive-products'
import { contextLeadingFeed } from '@/lib/context-recommendations'
import { resolveStoreContext } from '@/lib/store-context'
import { storeAwarePublicCacheHeaders } from '@/lib/store-cache-headers'

type ProductVariantInput = {
  color?: unknown
  size?: unknown
  image?: unknown
  price?: unknown
}

function normalizeVariants(input: unknown) {
  if (!Array.isArray(input)) return []

  return input
    .map((raw) => {
      const variant = raw as ProductVariantInput
      const color = String(variant?.color || '').trim()
      const size = String(variant?.size || '').trim()
      const image = String(variant?.image || '').trim()
      const price = Number(variant?.price)

      if (!image || (!color && !size)) return null
      return {
        color,
        size,
        image,
        ...(Number.isFinite(price) && price >= 0 ? { price } : {}),
      }
    })
    .filter(
      (variant): variant is { color: string; size: string; image: string; price?: number } => Boolean(variant)
    )
}

export async function GET(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { slug, store } = storeContext
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')
    const idsParam = searchParams.get('ids')
    const limitParam = Number(searchParams.get('limit'))
    const view = String(searchParams.get('view') || '').toLowerCase()
    const wholesaleOnly =
      searchParams.get('wholesale') === '1' ||
      searchParams.get('wholesale') === 'true' ||
      searchParams.get('b2b') === '1'

    const where: any = {
      storeId: store.id,
      isAvailable: true,
      NOT: {
        tags: {
          has: ARCHIVED_PRODUCT_TAG,
        },
      },
    }

    if (wholesaleOnly) {
      where.wholesalePrice = { not: null }
    }

    if (idsParam) {
      const ids = Array.from(
        new Set(
          idsParam
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        )
      )

      if (ids.length > 0) {
        where.id = { in: ids }
      }
    }

    if (categoryId) {
      const selectedCategory = await prisma.category.findFirst({
        where: {
          id: categoryId,
          storeId: store.id,
          isActive: true,
        },
        select: {
          name: true,
          type: true,
        },
      })

      if (!selectedCategory) {
        return NextResponse.json(
          { products: [] },
          {
            headers: storeAwarePublicCacheHeaders({
              sMaxAge: 10,
              staleWhileRevalidate: 30,
              queryVary: 'categoryId|category|search|ids|limit|view|wholesale|b2b',
            }),
          }
        )
      }

      if (selectedCategory.type === 'PRODUCT') {
        where.category = selectedCategory.name
      } else {
        where.tags = {
          has: selectedCategory.name,
        }
      }
    } else if (category && category !== 'all') {
      where.category = category
    }

    if (search) {
      void resolveUserId(request)
        .then((userId) => (userId ? recordUserSearch(storeContext.store.id, userId, search) : undefined))
        .catch(() => undefined)
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const queryArgs = {
      where,
      orderBy: { createdAt: 'desc' as const },
      ...(Number.isFinite(limitParam) && limitParam > 0 ? { take: Math.min(limitParam, 60) } : {}),
    }

    const cacheKey = REDIS_KEYS.PRODUCT_LIST(
      slug,
      JSON.stringify({
        category,
        categoryId,
        search,
        idsParam,
        wholesaleOnly,
        limit: Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 60) : null,
        view: view || 'full',
      })
    )

    const listed = await getOrSetJson(cacheKey, view === 'card' ? 180 : 90, async () =>
      view === 'card' ? findManyProductCardsCompat(queryArgs) : findManyProductsCompat(queryArgs)
    )
    // Festival mode: the plain feed (app home grid) leads with the current
    // festival or occasion, then nudges up products for the weather and time of day.
    const isPlainFeed = !category && !categoryId && !search && !idsParam && !wholesaleOnly
    const festivalOn = isPlainFeed
      ? await getAppSettings(storeContext.store).then((s) => s.festivalMode !== false).catch(() => false)
      : false
    const feedLimit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 60) : (listed as any[]).length
    const products = festivalOn
      ? await contextLeadingFeed(storeContext.store.id, listed as any[], feedLimit, {
          lat: Number(searchParams.get('lat')),
          lng: Number(searchParams.get('lng')),
          storeSlug: slug,
        }).catch(() => festiveFirst(listed as any[]))
      : listed

    return NextResponse.json(
      { products },
      {
        headers: storeAwarePublicCacheHeaders({
          sMaxAge: 10,
          staleWhileRevalidate: 30,
          queryVary: 'categoryId|category|search|ids|limit|view|wholesale|b2b',
        }),
      }
    )
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { store } = storeContext
    const body = await request.json()
    const { name, description, category, price, image, isVeg, showFoodTypeLabel, prepTime, tags, discount } = body

    const data = {
      storeId: store.id,
      name,
      miniDescription: String(body?.miniDescription || '').trim() || null,
      description,
      category,
      price,
      image,
      images: Array.isArray(body?.images) ? body.images : [],
      variants: normalizeVariants(body?.variants),
      imageAlt: name,
      showFoodTypeLabel: showFoodTypeLabel === true,
      isVeg,
      prepTime: prepTime || 15,
      tags: sanitizeProductTags(tags),
      discount: discount || 0,
    }

    const product = await withProductWriteCompatibility(data, (safeData) =>
      prisma.product.create({ data: safeData })
    )

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}
