import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG, sanitizeProductTags } from '@/lib/product-archive'
import { findManyProductCardsCompat, findManyProductsCompat, withProductWriteCompatibility } from '@/lib/product-db'
import { getOrSetJson, REDIS_KEYS } from '@/lib/redis'

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
            headers: {
              'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
              // Netlify must vary cache on filter query params.
              'Netlify-CDN-Cache-Control':
                'public, s-maxage=10, stale-while-revalidate=30',
              'Netlify-Vary': 'query=categoryId|category|search|ids|limit|view|wholesale|b2b',
            },
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

    const products = await getOrSetJson(cacheKey, view === 'card' ? 180 : 90, async () =>
      view === 'card' ? findManyProductCardsCompat(queryArgs) : findManyProductsCompat(queryArgs)
    )

    return NextResponse.json(
      { products },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
          // Without query vary, Netlify serves the first products response for
          // every categoryId (all header tabs looked identical).
          'Netlify-CDN-Cache-Control':
            'public, s-maxage=10, stale-while-revalidate=30',
          'Netlify-Vary': 'query=categoryId|category|search|ids|limit|view|wholesale|b2b',
        },
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
    const body = await request.json()
    const { name, description, category, price, image, isVeg, showFoodTypeLabel, prepTime, tags, discount } = body

    const data = {
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
