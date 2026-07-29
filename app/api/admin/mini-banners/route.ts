import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { normalizeMiniBannerLink, resolveMiniBannerLinks } from '@/lib/mini-banners'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const banners = await prisma.miniBanner.findMany({
      where: { storeId: storeContext.store.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json(await resolveMiniBannerLinks(banners))
  } catch (error) {
    console.error('Error fetching mini banners:', error)
    return NextResponse.json({ error: 'Failed to fetch mini banners' }, { status: 500 })
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
    const title = String(body.title ?? '').trim()
    const image = String(body.image ?? '').trim()

    if (!title || !image) {
      return NextResponse.json(
        { error: 'Title and image are required' },
        { status: 400 }
      )
    }
    const link = normalizeMiniBannerLink(body.linkType, body.linkId)
    const target = link.linkId
      ? link.linkType === 'PRODUCT'
        ? await prisma.product.findFirst({ where: { id: link.linkId, storeId: storeContext.store.id }, select: { id: true } })
        : await prisma.category.findFirst({ where: { id: link.linkId, storeId: storeContext.store.id }, select: { id: true } })
      : true
    if (!target) return NextResponse.json({ error: 'Invalid mini banner link' }, { status: 400 })

    const banner = await prisma.miniBanner.create({
      data: {
        storeId: storeContext.store.id,
        title,
        image,
        ...link,
        order: Number(body.order) || 0,
        isActive: body.isActive ?? true,
      },
    })

    await redis.del(REDIS_KEYS.HOME_MINI_BANNERS(storeContext.slug))
    const [resolved] = await resolveMiniBannerLinks([banner])
    return NextResponse.json(resolved)
  } catch (error) {
    console.error('Error creating mini banner:', error)
    return NextResponse.json({ error: 'Failed to create mini banner' }, { status: 500 })
  }
}
