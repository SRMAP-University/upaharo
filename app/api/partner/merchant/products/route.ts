import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireMerchant,
  resolveStoreIdsForPartner,
} from '@/lib/partner-auth'
import { ARCHIVED_PRODUCT_TAG, sanitizeProductTags } from '@/lib/product-archive'
import {
  findManyProductsCompat,
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

export async function GET(request: NextRequest) {
  try {
    const partner = await requireMerchant(request)
    if (!partner?.sellerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeIds = await resolveStoreIdsForPartner(partner.access, request)
    const products = await findManyProductsCompat({
      where: {
        ...(partner.access.fullAccess ? {} : { sellerId: partner.sellerId }),
        ...(storeIds.length ? { storeId: { in: storeIds } } : {}),
        NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error('Partner merchant products GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const partner = await requireMerchant(request)
    if (!partner?.sellerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const seller = await prisma.seller.findUnique({
      where: { id: partner.sellerId },
    })
    if (!partner.access.fullAccess && (!seller?.isActive || !seller.isVerified)) {
      return NextResponse.json(
        {
          error:
            'Your seller account must be active and verified to add products',
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const storeSlug =
      typeof body.storeSlug === 'string' ? body.storeSlug.trim() : 'gifts'
    if (
      (storeSlug === 'gifts' && !partner.access.giftsEnabled) ||
      (storeSlug === 'grocery' && !partner.access.groceryEnabled)
    ) {
      return NextResponse.json(
        { error: 'You do not have access to this store' },
        { status: 403 }
      )
    }

    const store = await prisma.store.findUnique({ where: { slug: storeSlug } })
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const variants = normalizeVariants(body?.variants)
    const tags = sanitizeProductTags(body?.tags)

    const data = {
      storeId: store.id,
      name: body.name,
      miniDescription: String(body?.miniDescription || '').trim() || null,
      description: body.description || '',
      category: body.category,
      price: parseFloat(body.price),
      image: body.image,
      images: body.images || [],
      variants,
      imageAlt: body.imageAlt,
      isAvailable: body.isAvailable !== false,
      showFoodTypeLabel: body.showFoodTypeLabel === true,
      isVeg: body.isVeg !== false,
      prepTime: body.prepTime || 15,
      tags,
      discount: body.discount || 0,
      sellerId: partner.sellerId,
      trackStock: body.trackStock === true,
      stockQty:
        body.trackStock === true
          ? body.stockQty !== undefined
            ? Number(body.stockQty)
            : 0
          : null,
      sku: body.sku || undefined,
    }

    const product = await withProductWriteCompatibility(data, (safeData) =>
      prisma.product.create({ data: safeData })
    )

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Partner merchant products POST:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}
