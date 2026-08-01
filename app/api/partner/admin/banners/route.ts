import { NextRequest, NextResponse } from 'next/server'
import {
  attachProductsToBanners,
  normalizeBannerCategory,
  normalizeBannerProductIds,
} from '@/lib/banner-products'
import {
  requirePartnerAdmin,
  resolvePartnerStoreContext,
} from '@/lib/partner-auth'
import { prisma } from '@/lib/prisma'
import { redis, REDIS_KEYS } from '@/lib/redis'

export async function GET(request: NextRequest) {
  try {
    const partner = await requirePartnerAdmin(request)
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const ctx = await resolvePartnerStoreContext(partner, request)
    if (!ctx) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const banners = await prisma.banner.findMany({
      where: { storeId: ctx.store.id },
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(await attachProductsToBanners(banners))
  } catch (error) {
    console.error('Partner admin banners GET:', error)
    return NextResponse.json({ error: 'Failed to fetch banners' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const partner = await requirePartnerAdmin(request)
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const ctx = await resolvePartnerStoreContext(partner, request)
    if (!ctx) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const body = await request.json()
    const title = String(body.title ?? '').trim()
    const image = String(body.image ?? '').trim()
    if (!title || !image) {
      return NextResponse.json(
        { error: 'Title and image are required' },
        { status: 400 }
      )
    }

    const productIds = normalizeBannerProductIds(body.productIds)
    const category =
      productIds.length > 0 ? null : normalizeBannerCategory(body.category)
    const sectionIdRaw =
      body.sectionId === null || body.sectionId === ''
        ? null
        : String(body.sectionId || '').trim() || null

    if (sectionIdRaw) {
      const section = await prisma.bannerSection.findFirst({
        where: { id: sectionIdRaw, storeId: ctx.store.id },
        select: { id: true },
      })
      if (!section) {
        return NextResponse.json({ error: 'Invalid banner section' }, { status: 400 })
      }
    }

    const banner = await prisma.banner.create({
      data: {
        storeId: ctx.store.id,
        sectionId: sectionIdRaw,
        title,
        subtitle: body.subtitle || null,
        image,
        link: body.link || null,
        bgColor: body.bgColor?.trim() || null,
        productIds,
        category,
        order: Number(body.order) || 0,
        isActive: body.isActive ?? true,
      },
    })
    await redis.del(REDIS_KEYS.HOME_BANNERS(ctx.slug), REDIS_KEYS.HOME(ctx.slug))
    const [withProducts] = await attachProductsToBanners([banner])
    return NextResponse.json(withProducts)
  } catch (error) {
    console.error('Partner admin banners POST:', error)
    return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 })
  }
}
