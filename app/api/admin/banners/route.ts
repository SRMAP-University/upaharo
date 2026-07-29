import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'
import {
  attachProductsToBanners,
  normalizeBannerCategory,
  normalizeBannerProductIds,
} from '@/lib/banner-products'

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const banners = await prisma.banner.findMany({
      where: { storeId: storeContext.store.id },
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
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const body = await request.json()
    const productIds = normalizeBannerProductIds(body.productIds)
    const category = productIds.length > 0 ? null : normalizeBannerCategory(body.category)
    const sectionIdRaw = body.sectionId === null || body.sectionId === '' ? null : String(body.sectionId || '').trim() || null
    const [products, categoryRow, sectionRow] = await Promise.all([
      productIds.length
        ? prisma.product.findMany({ where: { id: { in: productIds }, storeId: storeContext.store.id }, select: { id: true } })
        : Promise.resolve([]),
      category
        ? prisma.category.findFirst({ where: { storeId: storeContext.store.id, name: { equals: category, mode: 'insensitive' } }, select: { id: true } })
        : Promise.resolve(null),
      sectionIdRaw
        ? prisma.bannerSection.findFirst({
            where: { id: sectionIdRaw, storeId: storeContext.store.id },
            select: { id: true },
          })
        : Promise.resolve(null),
    ])
    if (products.length !== productIds.length || (category && !categoryRow)) {
      return NextResponse.json({ error: 'Invalid banner product or category' }, { status: 400 })
    }
    if (sectionIdRaw && !sectionRow) {
      return NextResponse.json({ error: 'Invalid banner section' }, { status: 400 })
    }

    const banner = await prisma.banner.create({
      data: {
        storeId: storeContext.store.id,
        sectionId: sectionIdRaw,
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
    await redis.del(REDIS_KEYS.HOME_BANNERS(storeContext.slug))
    const [withProducts] = await attachProductsToBanners([banner])
    return NextResponse.json(withProducts)
  } catch (error) {
    console.error('Error creating banner:', error)
    return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 })
  }
}
