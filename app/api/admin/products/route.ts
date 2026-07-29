import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sanitizeProductTags } from '@/lib/product-archive'
import { findManyProductsCompat, withProductWriteCompatibility } from '@/lib/product-db'
import {
  buildAdminProductWhere,
  normalizeGroceryFields,
  normalizeImagesList,
  normalizeInventoryFields,
  productListOrderBy,
} from '@/lib/product-fields'
import { normalizePickupInput } from '@/lib/pickup'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

function toNumber(value: unknown, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

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
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const availability = searchParams.get('availability')
    const archived = searchParams.get('archived') === '1'
    const sort = searchParams.get('sort')
    const idsParam = searchParams.get('ids')

    const ids = idsParam
      ? Array.from(
          new Set(
            idsParam
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          )
        )
      : undefined

    const where = buildAdminProductWhere({
      storeId: storeContext.store.id,
      category,
      search,
      availability,
      archived,
      ids,
    })

    const page = Math.max(1, Math.round(toNumber(searchParams.get('page'), 1)))
    const limit = Math.min(100, Math.max(1, Math.round(toNumber(searchParams.get('limit'), 50))))
    const skip = (page - 1) * limit
    const orderBy = productListOrderBy(sort)

    const [products, total] = await Promise.all([
      findManyProductsCompat({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json(
      {
        products,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        storeSlug: storeContext.slug,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
          Vary: 'Cookie',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching admin products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const body = await request.json()

    const name = String(body?.name || '').trim()
    const description = String(body?.description || '').trim()
    const category = String(body?.category || '').trim()
    const image = String(body?.image || '').trim()

    if (!name || !description || !category || !image) {
      return NextResponse.json(
        { error: 'name, description, category and image are required' },
        { status: 400 }
      )
    }
    if (!(await prisma.category.findFirst({ where: { name: { equals: category, mode: 'insensitive' }, storeId: storeContext.store.id }, select: { id: true } }))) {
      return NextResponse.json({ error: 'Invalid product category' }, { status: 400 })
    }

    const price = toNumber(body?.price, NaN)
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json(
        { error: 'price must be a valid non-negative number' },
        { status: 400 }
      )
    }

    let wholesalePrice: number | null = null
    if (body?.wholesalePrice !== undefined && body?.wholesalePrice !== null && body?.wholesalePrice !== '') {
      const wp = toNumber(body.wholesalePrice, NaN)
      if (!Number.isFinite(wp) || wp < 0) {
        return NextResponse.json(
          { error: 'wholesalePrice must be a valid non-negative number' },
          { status: 400 }
        )
      }
      wholesalePrice = wp
    }

    const images = normalizeImagesList(body?.images)
    const tags = sanitizeProductTags(body?.tags)
    const variants = normalizeVariants(body?.variants)

    const pickup = normalizePickupInput(body)
    if (!pickup.ok) {
      return NextResponse.json({ error: pickup.error }, { status: 400 })
    }

    const inventory = normalizeInventoryFields(body)
    if (!inventory.ok) {
      return NextResponse.json({ error: inventory.error }, { status: 400 })
    }

    const grocery = normalizeGroceryFields(body)
    if (!grocery.ok) {
      return NextResponse.json({ error: grocery.error }, { status: 400 })
    }

    if (inventory.data.sku) {
      const clash = await prisma.product.findFirst({
        where: {
          storeId: storeContext.store.id,
          sku: inventory.data.sku,
        },
        select: { id: true },
      })
      if (clash) {
        return NextResponse.json({ error: 'SKU already exists in this store' }, { status: 400 })
      }
    }

    const data = {
      storeId: storeContext.store.id,
      name,
      miniDescription: String(body?.miniDescription || '').trim() || null,
      description,
      category,
      price,
      wholesalePrice,
      image,
      images,
      variants,
      imageAlt: String(body?.imageAlt || '').trim() || name,
      showFoodTypeLabel: body?.showFoodTypeLabel === true,
      isVeg: Boolean(body?.isVeg),
      prepTime: Math.max(1, Math.round(toNumber(body?.prepTime, 15))),
      tags,
      discount: Math.max(0, toNumber(body?.discount, 0)),
      isAvailable: body?.isAvailable !== false,
      ...pickup.data,
      ...inventory.data,
      ...grocery.data,
    }

    const product = await withProductWriteCompatibility(data, (safeData) =>
      prisma.product.create({ data: safeData })
    )

    await redis.del(REDIS_KEYS.HOME(storeContext.slug))

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('Error creating admin product:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}
