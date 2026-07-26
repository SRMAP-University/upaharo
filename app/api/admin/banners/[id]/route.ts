import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis, REDIS_KEYS } from '@/lib/redis'
import {
  attachProductsToBanners,
  normalizeBannerCategory,
  normalizeBannerProductIds,
} from '@/lib/banner-products'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const productIds = normalizeBannerProductIds(body.productIds)
    const category = productIds.length > 0 ? null : normalizeBannerCategory(body.category)

    const banner = await prisma.banner.update({
      where: { id },
      data: {
        title: body.title,
        subtitle: body.subtitle || null,
        image: body.image,
        link: body.link || null,
        bgColor: body.bgColor?.trim() || null,
        productIds,
        category,
        order: body.order,
        isActive: body.isActive,
      },
    })
    await redis.del(REDIS_KEYS.HOME_BANNERS)
    const [withProducts] = await attachProductsToBanners([banner])
    return NextResponse.json(withProducts)
  } catch (error) {
    console.error('Error updating banner:', error)
    return NextResponse.json({ error: 'Failed to update banner' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.banner.delete({
      where: { id },
    })
    await redis.del(REDIS_KEYS.HOME_BANNERS)
    return NextResponse.json({ message: 'Banner deleted' })
  } catch (error) {
    console.error('Error deleting banner:', error)
    return NextResponse.json({ error: 'Failed to delete banner' }, { status: 500 })
  }
}
