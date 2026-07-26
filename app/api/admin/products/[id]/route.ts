import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG, appendArchivedProductTag, sanitizeProductTags } from '@/lib/product-archive'
import { findFirstProductCompat, withProductWriteCompatibility } from '@/lib/product-db'
import { redis, REDIS_KEYS } from '@/lib/redis'

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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const product = await findFirstProductCompat({
      where: {
        id,
        NOT: {
          tags: {
            has: ARCHIVED_PRODUCT_TAG,
          },
        },
      }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
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
    const body = await request.json()
    const { id } = await params
    const data: Record<string, unknown> = { ...body }

    if (body?.variants !== undefined) {
      data.variants = normalizeVariants(body.variants)
    }

    if (body?.tags !== undefined) {
      data.tags = sanitizeProductTags(body.tags)
    }

    if (body?.miniDescription !== undefined) {
      data.miniDescription = String(body.miniDescription || '').trim() || null
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

    const product = await withProductWriteCompatibility(data, (safeData) =>
      prisma.product.updateMany({
        where: {
          id,
          NOT: {
            tags: {
              has: ARCHIVED_PRODUCT_TAG,
            },
          },
        },
        data: safeData,
      })
    )

    if (product.count === 0) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    const updatedProduct = await findFirstProductCompat({
      where: {
        id,
        NOT: {
          tags: {
            has: ARCHIVED_PRODUCT_TAG,
          },
        },
      }
    })

    await redis.del(REDIS_KEYS.PRODUCT_DETAIL(id), REDIS_KEYS.HOME)

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
    const { id } = await params

    const product = await prisma.product.findFirst({
      where: {
        id,
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
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    if (product._count.orderItems > 0) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          isAvailable: false,
          tags: appendArchivedProductTag(product.tags),
        },
      })

      await redis.del(REDIS_KEYS.PRODUCT_DETAIL(product.id), REDIS_KEYS.HOME)

      return NextResponse.json({ success: true, archived: true })
    }

    await prisma.product.delete({
      where: { id: product.id }
    })

    await redis.del(REDIS_KEYS.PRODUCT_DETAIL(product.id), REDIS_KEYS.HOME)

    return NextResponse.json({ success: true, archived: false })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete product' },
      { status: 500 }
    )
  }
}
