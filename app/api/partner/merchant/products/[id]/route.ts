import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMerchant } from '@/lib/partner-auth'
import {
  ARCHIVED_PRODUCT_TAG,
  appendArchivedProductTag,
  sanitizeProductTags,
} from '@/lib/product-archive'
import {
  findFirstProductCompat,
  withProductWriteCompatibility,
} from '@/lib/product-db'

type ProductVariantInput = {
  color?: unknown
  size?: unknown
  image?: unknown
}

function normalizeVariants(input: unknown) {
  if (!Array.isArray(input)) return []
  return input
    .map((raw) => {
      const variant = raw as ProductVariantInput
      const color = String(variant?.color || '').trim()
      const size = String(variant?.size || '').trim()
      const image = String(variant?.image || '').trim()
      if (!image || (!color && !size)) return null
      return { color, size, image }
    })
    .filter(
      (variant): variant is { color: string; size: string; image: string } =>
        Boolean(variant)
    )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partner = await requireMerchant(request)
    if (!partner?.sellerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const product = await findFirstProductCompat({
      where: {
        id,
        ...(partner.access.fullAccess ? {} : { sellerId: partner.sellerId }),
        NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
      },
    })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    return NextResponse.json(product)
  } catch (error) {
    console.error('Partner product GET:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partner = await requireMerchant(request)
    if (!partner?.sellerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.product.findFirst({
      where: {
        id,
        ...(partner.access.fullAccess ? {} : { sellerId: partner.sellerId }),
      },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.miniDescription !== undefined) {
      data.miniDescription = String(body.miniDescription || '').trim() || null
    }
    if (body.description !== undefined) data.description = body.description
    if (body.category !== undefined) data.category = body.category
    if (body.price !== undefined) data.price = parseFloat(body.price)
    if (body.image !== undefined) data.image = body.image
    if (body.images !== undefined) data.images = body.images
    if (body.variants !== undefined) data.variants = normalizeVariants(body.variants)
    if (body.imageAlt !== undefined) data.imageAlt = body.imageAlt
    if (body.isAvailable !== undefined) data.isAvailable = Boolean(body.isAvailable)
    if (body.showFoodTypeLabel !== undefined) {
      data.showFoodTypeLabel = body.showFoodTypeLabel === true
    }
    if (body.isVeg !== undefined) data.isVeg = body.isVeg !== false
    if (body.prepTime !== undefined) data.prepTime = body.prepTime
    if (body.tags !== undefined) data.tags = sanitizeProductTags(body.tags)
    if (body.discount !== undefined) data.discount = body.discount || 0
    if (body.trackStock !== undefined) data.trackStock = Boolean(body.trackStock)
    if (body.stockQty !== undefined) {
      data.stockQty =
        body.trackStock === false ? null : Number(body.stockQty)
    }
    if (body.sku !== undefined) data.sku = body.sku || null
    if (body.discount !== undefined) data.discount = body.discount || 0

    const product = await withProductWriteCompatibility(data, (safeData) =>
      prisma.product.update({ where: { id }, data: safeData })
    )

    return NextResponse.json(product)
  } catch (error) {
    console.error('Partner product PATCH:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partner = await requireMerchant(request)
    if (!partner?.sellerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await prisma.product.findFirst({
      where: {
        id,
        ...(partner.access.fullAccess ? {} : { sellerId: partner.sellerId }),
      },
      select: { id: true, tags: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    await prisma.product.update({
      where: { id },
      data: {
        isAvailable: false,
        tags: appendArchivedProductTag(existing.tags),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Partner product DELETE:', error)
    return NextResponse.json({ error: 'Failed to archive product' }, { status: 500 })
  }
}
