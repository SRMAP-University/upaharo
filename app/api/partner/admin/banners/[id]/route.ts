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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partner = await requirePartnerAdmin(request)
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const ctx = await resolvePartnerStoreContext(partner, request)
    if (!ctx) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const { id } = await params
    const body = await request.json()
    const existing = await prisma.banner.findFirst({
      where: { id, storeId: ctx.store.id },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Banner not found' }, { status: 404 })
    }

    const productIds =
      body.productIds !== undefined
        ? normalizeBannerProductIds(body.productIds)
        : undefined
    const category =
      productIds !== undefined
        ? productIds.length > 0
          ? null
          : normalizeBannerCategory(body.category)
        : undefined

    const banner = await prisma.banner.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
        ...(body.subtitle !== undefined ? { subtitle: body.subtitle || null } : {}),
        ...(body.image !== undefined ? { image: String(body.image) } : {}),
        ...(body.link !== undefined ? { link: body.link || null } : {}),
        ...(body.bgColor !== undefined
          ? { bgColor: body.bgColor?.trim() || null }
          : {}),
        ...(productIds !== undefined ? { productIds } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(body.order !== undefined ? { order: Number(body.order) || 0 } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        ...(body.sectionId !== undefined
          ? {
              sectionId:
                body.sectionId === null || body.sectionId === ''
                  ? null
                  : String(body.sectionId),
            }
          : {}),
      },
    })
    await redis.del(REDIS_KEYS.HOME_BANNERS(ctx.slug), REDIS_KEYS.HOME(ctx.slug))
    const [withProducts] = await attachProductsToBanners([banner])
    return NextResponse.json(withProducts)
  } catch (error) {
    console.error('Partner admin banners PATCH:', error)
    return NextResponse.json({ error: 'Failed to update banner' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partner = await requirePartnerAdmin(request)
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const ctx = await resolvePartnerStoreContext(partner, request)
    if (!ctx) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const { id } = await params
    const result = await prisma.banner.deleteMany({
      where: { id, storeId: ctx.store.id },
    })
    if (result.count === 0) {
      return NextResponse.json({ error: 'Banner not found' }, { status: 404 })
    }
    await redis.del(REDIS_KEYS.HOME_BANNERS(ctx.slug), REDIS_KEYS.HOME(ctx.slug))
    return NextResponse.json({ message: 'Banner deleted' })
  } catch (error) {
    console.error('Partner admin banners DELETE:', error)
    return NextResponse.json({ error: 'Failed to delete banner' }, { status: 500 })
  }
}
