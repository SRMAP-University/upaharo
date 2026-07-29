import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG, appendArchivedProductTag, sanitizeProductTags } from '@/lib/product-archive'
import { findFirstProductCompat, withProductWriteCompatibility } from '@/lib/product-db'
import {
  normalizeGroceryFields,
  normalizeImagesList,
  normalizeInventoryFields,
} from '@/lib/product-fields'
import { normalizePickupInput } from '@/lib/pickup'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireAdmin(_request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { id } = await params

    const product = await findFirstProductCompat({
      where: {
        id,
        storeId: storeContext.store.id,
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const body = await request.json()
    const { id } = await params
    const data: Record<string, unknown> = { ...body }
    delete data.storeId

    if (body?.category !== undefined) {
      const category = String(body.category || '').trim()
      if (
        !category ||
        !(await prisma.category.findFirst({
          where: {
            name: { equals: category, mode: 'insensitive' },
            storeId: storeContext.store.id,
          },
          select: { id: true },
        }))
      ) {
        return NextResponse.json({ error: 'Invalid product category' }, { status: 400 })
      }
      data.category = category
    }

    if (body?.variants !== undefined) {
      data.variants = normalizeVariants(body.variants)
    }

    if (body?.tags !== undefined) {
      data.tags = sanitizeProductTags(body.tags)
    }

    if (body?.images !== undefined) {
      data.images = normalizeImagesList(body.images)
    }

    if (body?.miniDescription !== undefined) {
      data.miniDescription = String(body.miniDescription || '').trim() || null
    }

    if (body?.pickupEnabled !== undefined) {
      const pickup = normalizePickupInput(body)
      if (!pickup.ok) {
        return NextResponse.json({ error: pickup.error }, { status: 400 })
      }
      Object.assign(data, pickup.data)
    }

    if (body?.wholesalePrice !== undefined) {
      if (body.wholesalePrice === null || body.wholesalePrice === '') {
        data.wholesalePrice = null
      } else {
        const wp = Number(body.wholesalePrice)
        if (!Number.isFinite(wp) || wp < 0) {
          return NextResponse.json(
            { error: 'wholesalePrice must be a valid non-negative number' },
            { status: 400 }
          )
        }
        data.wholesalePrice = wp
      }
    }

    if (
      body?.trackStock !== undefined ||
      body?.stockQty !== undefined ||
      body?.sku !== undefined
    ) {
      const inventory = normalizeInventoryFields(body)
      if (!inventory.ok) {
        return NextResponse.json({ error: inventory.error }, { status: 400 })
      }
      Object.assign(data, inventory.data)

      if (inventory.data.sku) {
        const clash = await prisma.product.findFirst({
          where: {
            storeId: storeContext.store.id,
            sku: inventory.data.sku,
            NOT: { id },
          },
          select: { id: true },
        })
        if (clash) {
          return NextResponse.json({ error: 'SKU already exists in this store' }, { status: 400 })
        }
      }
    }

    if (body?.unit !== undefined || body?.unitValue !== undefined || body?.aisle !== undefined) {
      const grocery = normalizeGroceryFields(body)
      if (!grocery.ok) {
        return NextResponse.json({ error: grocery.error }, { status: 400 })
      }
      Object.assign(data, grocery.data)
    }

    const product = await withProductWriteCompatibility(data, (safeData) =>
      prisma.product.updateMany({
        where: {
          id,
          storeId: storeContext.store.id,
        },
        data: safeData,
      })
    )

    if (product.count === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const updatedProduct = await findFirstProductCompat({
      where: {
        id,
        storeId: storeContext.store.id,
      },
    })

    await redis.del(
      REDIS_KEYS.PRODUCT_DETAIL(storeContext.slug, id),
      REDIS_KEYS.HOME(storeContext.slug)
    )

    return NextResponse.json(updatedProduct)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update product' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { id } = await params

    const product = await prisma.product.findFirst({
      where: {
        id,
        storeId: storeContext.store.id,
        NOT: {
          tags: {
            has: ARCHIVED_PRODUCT_TAG,
          },
        },
      },
      select: {
        id: true,
        tags: true,
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (product._count.orderItems > 0) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          isAvailable: false,
          tags: appendArchivedProductTag(product.tags),
        },
      })

      await redis.del(
        REDIS_KEYS.PRODUCT_DETAIL(storeContext.slug, product.id),
        REDIS_KEYS.HOME(storeContext.slug)
      )

      return NextResponse.json({ success: true, archived: true })
    }

    await prisma.product.delete({
      where: { id: product.id },
    })

    await redis.del(
      REDIS_KEYS.PRODUCT_DETAIL(storeContext.slug, product.id),
      REDIS_KEYS.HOME(storeContext.slug)
    )

    return NextResponse.json({ success: true, archived: false })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete product' },
      { status: 500 }
    )
  }
}
