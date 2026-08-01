import { NextRequest, NextResponse } from 'next/server'
import { normalizeMiniBannerLink, resolveMiniBannerLinks } from '@/lib/mini-banners'
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
    const existing = await prisma.miniBanner.findFirst({
      where: { id, storeId: ctx.store.id },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Mini banner not found' }, { status: 404 })
    }

    const body = await request.json()
    const link =
      body.linkType !== undefined || body.linkId !== undefined
        ? normalizeMiniBannerLink(body.linkType, body.linkId)
        : null

    const banner = await prisma.miniBanner.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
        ...(body.image !== undefined ? { image: String(body.image).trim() } : {}),
        ...(link ? link : {}),
        ...(body.order !== undefined ? { order: Number(body.order) || 0 } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
      },
    })
    await redis.del(REDIS_KEYS.HOME(ctx.slug))
    const [resolved] = await resolveMiniBannerLinks([banner])
    return NextResponse.json(resolved)
  } catch (error) {
    console.error('Partner admin mini-banners PATCH:', error)
    return NextResponse.json({ error: 'Failed to update mini banner' }, { status: 500 })
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
    const result = await prisma.miniBanner.deleteMany({
      where: { id, storeId: ctx.store.id },
    })
    if (result.count === 0) {
      return NextResponse.json({ error: 'Mini banner not found' }, { status: 404 })
    }
    await redis.del(REDIS_KEYS.HOME(ctx.slug))
    return NextResponse.json({ message: 'Mini banner deleted' })
  } catch (error) {
    console.error('Partner admin mini-banners DELETE:', error)
    return NextResponse.json({ error: 'Failed to delete mini banner' }, { status: 500 })
  }
}
