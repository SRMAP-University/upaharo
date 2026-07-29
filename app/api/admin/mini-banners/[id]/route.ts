import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { normalizeMiniBannerLink, resolveMiniBannerLinks } from '@/lib/mini-banners'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

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
    const title = String(body.title ?? '').trim()
    const image = String(body.image ?? '').trim()

    if (!title || !image) {
      return NextResponse.json(
        { error: 'Title and image are required' },
        { status: 400 }
      )
    }
    const link = normalizeMiniBannerLink(body.linkType, body.linkId)
    const [existing, target] = await Promise.all([
      prisma.miniBanner.findFirst({ where: { id, storeId: storeContext.store.id }, select: { id: true } }),
      link.linkId
        ? link.linkType === 'PRODUCT'
          ? prisma.product.findFirst({ where: { id: link.linkId, storeId: storeContext.store.id }, select: { id: true } })
          : prisma.category.findFirst({ where: { id: link.linkId, storeId: storeContext.store.id }, select: { id: true } })
        : Promise.resolve(true),
    ])
    if (!existing) return NextResponse.json({ error: 'Mini banner not found' }, { status: 404 })
    if (!target) return NextResponse.json({ error: 'Invalid mini banner link' }, { status: 400 })

    const banner = await prisma.miniBanner.update({
      where: { id },
      data: {
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
    console.error('Error updating mini banner:', error)
    return NextResponse.json({ error: 'Failed to update mini banner' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireAdmin(_request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { id } = await params
    const result = await prisma.miniBanner.deleteMany({ where: { id, storeId: storeContext.store.id } })
    if (result.count === 0) return NextResponse.json({ error: 'Mini banner not found' }, { status: 404 })
    await redis.del(REDIS_KEYS.HOME_MINI_BANNERS(storeContext.slug))
    return NextResponse.json({ message: 'Mini banner deleted' })
  } catch (error) {
    console.error('Error deleting mini banner:', error)
    return NextResponse.json({ error: 'Failed to delete mini banner' }, { status: 500 })
  }
}
