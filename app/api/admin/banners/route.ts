import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis, REDIS_KEYS } from '@/lib/redis'
import {
  attachProductsToBanners,
  normalizeBannerCategory,
  normalizeBannerProductIds,
} from '@/lib/banner-products'

export async function GET() {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: { order: 'asc' },
    })
    const withProducts = await attachProductsToBanners(banners)
    return NextResponse.json(withProducts)
  } catch (error) {
    console.error('Error fetching banners:', error)
    return NextResponse.json({ error: 'Failed to fetch banners' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const productIds = normalizeBannerProductIds(body.productIds)
    const category = productIds.length > 0 ? null : normalizeBannerCategory(body.category)

    const banner = await prisma.banner.create({
      data: {
        title: body.title,
        subtitle: body.subtitle || null,
        image: body.image,
        link: body.link || null,
        bgColor: body.bgColor?.trim() || null,
        productIds,
        category,
        order: body.order || 0,
        isActive: body.isActive ?? true,
      },
    })
    await redis.del(REDIS_KEYS.HOME_BANNERS)
    const [withProducts] = await attachProductsToBanners([banner])
    return NextResponse.json(withProducts)
  } catch (error) {
    console.error('Error creating banner:', error)
    return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 })
  }
}
