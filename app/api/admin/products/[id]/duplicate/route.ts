import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG, sanitizeProductTags } from '@/lib/product-archive'
import { withProductWriteCompatibility } from '@/lib/product-db'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export async function POST(
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

    const source = await prisma.product.findFirst({
      where: {
        id,
        storeId: storeContext.store.id,
        NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
      },
    })

    if (!source) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const data = {
      storeId: storeContext.store.id,
      name: `${source.name} (Copy)`.slice(0, 200),
      miniDescription: source.miniDescription,
      description: source.description,
      category: source.category,
      price: source.price,
      wholesalePrice: source.wholesalePrice,
      image: source.image,
      images: source.images,
      variants: source.variants as object[],
      imageAlt: source.imageAlt,
      isAvailable: false,
      showFoodTypeLabel: source.showFoodTypeLabel,
      isVeg: source.isVeg,
      prepTime: source.prepTime,
      tags: sanitizeProductTags(source.tags),
      discount: source.discount,
      sku: null,
      trackStock: source.trackStock,
      stockQty: source.trackStock ? source.stockQty : null,
      unit: source.unit,
      unitValue: source.unitValue,
      aisle: source.aisle,
      pickupEnabled: source.pickupEnabled,
      pickupLatitude: source.pickupLatitude,
      pickupLongitude: source.pickupLongitude,
      pickupAddress: source.pickupAddress,
      sellerId: source.sellerId,
    }

    const product = await withProductWriteCompatibility(data, (safeData) =>
      prisma.product.create({ data: safeData })
    )

    await redis.del(REDIS_KEYS.HOME(storeContext.slug))

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('Duplicate product error:', error)
    return NextResponse.json({ error: 'Failed to duplicate product' }, { status: 500 })
  }
}
