import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { PRODUCT_CARD_SELECT } from '@/lib/product-db'
import { resolveUserId } from '@/lib/request-auth'

/** Saved products for the authenticated user, newest first. */
export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const items = await prisma.wishlistItem.findMany({
      where: {
        userId,
        product: {
          NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: PRODUCT_CARD_SELECT } },
    })

    return NextResponse.json({
      items,
      productIds: items.map((item) => item.productId),
    })
  } catch (error) {
    console.error('Wishlist list error:', error)
    return NextResponse.json({ error: 'Failed to load wishlist' }, { status: 500 })
  }
}

/** Save a product. Body: { productId } */
export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const productId = String(body?.productId || '').trim()
    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const item = await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
      include: { product: { select: PRODUCT_CARD_SELECT } },
    })

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Wishlist save error:', error)
    return NextResponse.json({ error: 'Failed to save product' }, { status: 500 })
  }
}

/** Remove a saved product. Query: ?productId= */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const productId = String(searchParams.get('productId') || '').trim()
    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    await prisma.wishlistItem.deleteMany({ where: { userId, productId } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Wishlist remove error:', error)
    return NextResponse.json({ error: 'Failed to remove product' }, { status: 500 })
  }
}
