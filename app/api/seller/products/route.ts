import { NextResponse } from 'next/server'
import { allowedFoodTypeLabel } from '@/lib/food-products'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG, sanitizeProductTags } from '@/lib/product-archive'
import { findManyProductsCompat, withProductWriteCompatibility } from '@/lib/product-db'

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
    .filter((variant): variant is { color: string; size: string; image: string } => Boolean(variant))
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get seller profile
    const seller = await prisma.seller.findUnique({
      where: { userId: session.user.id },
    })

    if (!seller) {
      return NextResponse.json({ error: 'Seller profile not found' }, { status: 404 })
    }

    // Get seller's products
    const products = await findManyProductsCompat({
      where: {
        sellerId: seller.id,
        NOT: {
          tags: {
            has: ARCHIVED_PRODUCT_TAG,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching seller products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get seller profile
    const seller = await prisma.seller.findUnique({
      where: { userId: session.user.id },
    })

    if (!seller) {
      return NextResponse.json({ error: 'Seller profile not found' }, { status: 404 })
    }

    if (!seller.isActive || !seller.isVerified) {
      return NextResponse.json(
        { error: 'Your seller account must be active and verified to add products' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const variants = normalizeVariants(body?.variants)
    const tags = sanitizeProductTags(body?.tags)

    const data = {
      name: body.name,
      miniDescription: String(body?.miniDescription || '').trim() || null,
      description: body.description,
      category: body.category,
      price: parseFloat(body.price),
      image: body.image,
      images: body.images || [],
      variants,
      imageAlt: body.imageAlt,
      isAvailable: body.isAvailable !== false,
      showFoodTypeLabel: allowedFoodTypeLabel(body.showFoodTypeLabel, { category: body.category, name: body.name }),
      isVeg: body.isVeg !== false,
      prepTime: body.prepTime || 15,
      tags,
      discount: body.discount || 0,
      sellerId: seller.id,
    }

    const product = await withProductWriteCompatibility(data, (safeData) =>
      prisma.product.create({ data: safeData })
    )

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
