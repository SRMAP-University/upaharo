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

export async function PATCH(
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
    const body = await request.json()
    const productIds = normalizeBannerProductIds(body.productIds)
    const category = productIds.length > 0 ? null : normalizeBannerCategory(body.category)
    const sectionIdRaw =
      body.sectionId === undefined
        ? undefined
        : body.sectionId === null || body.sectionId === ''
          ? null
          : String(body.sectionId || '').trim() || null
    const [existing, products, categoryRow, sectionRow] = await Promise.all([
      prisma.banner.findFirst({ where: { id, storeId: storeContext.store.id }, select: { id: true } }),
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
    if (!existing) return NextResponse.json({ error: 'Banner not found' }, { status: 404 })
    if (products.length !== productIds.length || (category && !categoryRow)) {
      return NextResponse.json({ error: 'Invalid banner product or category' }, { status: 400 })
    }
    if (sectionIdRaw && !sectionRow) {
      return NextResponse.json({ error: 'Invalid banner section' }, { status: 400 })
    }

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
        ...(sectionIdRaw !== undefined ? { sectionId: sectionIdRaw } : {}),
      },
    })
    await redis.del(REDIS_KEYS.HOME_BANNERS(storeContext.slug))
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
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { id } = await params
    const result = await prisma.banner.deleteMany({ where: { id, storeId: storeContext.store.id } })
    if (result.count === 0) return NextResponse.json({ error: 'Banner not found' }, { status: 404 })
    await redis.del(REDIS_KEYS.HOME_BANNERS(storeContext.slug))
    return NextResponse.json({ message: 'Banner deleted' })
  } catch (error) {
    console.error('Error deleting banner:', error)
    return NextResponse.json({ error: 'Failed to delete banner' }, { status: 500 })
  }
}
