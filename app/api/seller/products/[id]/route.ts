import { NextResponse } from 'next/server'
import { allowedFoodTypeLabel } from '@/lib/food-products'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG, appendArchivedProductTag, sanitizeProductTags } from '@/lib/product-archive'
import { findFirstProductCompat, withProductWriteCompatibility } from '@/lib/product-db'

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const seller = await prisma.seller.findUnique({
      where: { userId: session.user.id },
    })

    if (!seller) {
      return NextResponse.json({ error: 'Seller profile not found' }, { status: 404 })
    }

    const { id } = await params

    const product = await findFirstProductCompat({
      where: {
        id,
        sellerId: seller.id,
        NOT: {
          tags: {
            has: ARCHIVED_PRODUCT_TAG,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const seller = await prisma.seller.findUnique({
      where: { userId: session.user.id },
    })

    if (!seller) {
      return NextResponse.json({ error: 'Seller profile not found' }, { status: 404 })
    }

    const body = await request.json()
    const { id } = await params

    // Veg / non-veg badge only on food.
    let foodLabel: boolean | undefined
    if (body.showFoodTypeLabel !== undefined || body.category || body.name) {
      const current = await prisma.product.findFirst({
        where: { id, sellerId: seller.id },
        select: { category: true, name: true, showFoodTypeLabel: true },
      })
      foodLabel = allowedFoodTypeLabel(
        body.showFoodTypeLabel !== undefined ? body.showFoodTypeLabel === true : current?.showFoodTypeLabel,
        { category: body.category || current?.category, name: body.name || current?.name }
      )
    }

    const updateArgs = {
      where: {
        id,
        sellerId: seller.id,
        NOT: {
          tags: {
            has: ARCHIVED_PRODUCT_TAG,
          },
        },
      },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.miniDescription !== undefined && {
          miniDescription: String(body.miniDescription || '').trim() || null,
        }),
        ...(body.description && { description: body.description }),
        ...(body.category && { category: body.category }),
        ...(body.price !== undefined && { price: parseFloat(body.price) }),
        ...(body.image && { image: body.image }),
        ...(body.images && { images: body.images }),
        ...(body.variants !== undefined && { variants: normalizeVariants(body.variants) }),
        ...(body.imageAlt !== undefined && { imageAlt: body.imageAlt }),
        ...(body.isAvailable !== undefined && { isAvailable: body.isAvailable }),
        ...(foodLabel !== undefined && { showFoodTypeLabel: foodLabel }),
        ...(body.isVeg !== undefined && { isVeg: body.isVeg }),
        ...(body.prepTime !== undefined && { prepTime: body.prepTime }),
        ...(body.tags !== undefined && { tags: sanitizeProductTags(body.tags) }),
        ...(body.discount !== undefined && { discount: body.discount }),
      },
    }

    const product = await withProductWriteCompatibility(
      updateArgs.data as Record<string, unknown>,
      (safeData) =>
        prisma.product.updateMany({
          ...updateArgs,
          data: safeData,
        })
    )

    if (product.count === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const updatedProduct = await findFirstProductCompat({
      where: {
        id,
        sellerId: seller.id,
        NOT: {
          tags: {
            has: ARCHIVED_PRODUCT_TAG,
          },
        },
      },
    })

    return NextResponse.json(updatedProduct)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const seller = await prisma.seller.findUnique({
      where: { userId: session.user.id },
    })

    if (!seller) {
      return NextResponse.json({ error: 'Seller profile not found' }, { status: 404 })
    }

    const { id } = await params

    const product = await prisma.product.findFirst({
      where: {
        id,
        sellerId: seller.id,
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

      return NextResponse.json({
        message: 'Product archived successfully',
        archived: true,
      })
    }

    await prisma.product.delete({
      where: { id: product.id },
    })

    return NextResponse.json({
      message: 'Product deleted successfully',
      archived: false,
    })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
