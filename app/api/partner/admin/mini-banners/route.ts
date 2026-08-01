import { NextRequest, NextResponse } from 'next/server'
import { normalizeMiniBannerLink, resolveMiniBannerLinks } from '@/lib/mini-banners'
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

    const banners = await prisma.miniBanner.findMany({
      where: { storeId: ctx.store.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json(await resolveMiniBannerLinks(banners))
  } catch (error) {
    console.error('Partner admin mini-banners GET:', error)
    return NextResponse.json({ error: 'Failed to fetch mini banners' }, { status: 500 })
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

    const link = normalizeMiniBannerLink(body.linkType, body.linkId)
    const banner = await prisma.miniBanner.create({
      data: {
        storeId: ctx.store.id,
        title,
        image,
        ...link,
        order: Number(body.order) || 0,
        isActive: body.isActive ?? true,
      },
    })
    await redis.del(REDIS_KEYS.HOME(ctx.slug))
    const [resolved] = await resolveMiniBannerLinks([banner])
    return NextResponse.json(resolved)
  } catch (error) {
    console.error('Partner admin mini-banners POST:', error)
    return NextResponse.json({ error: 'Failed to create mini banner' }, { status: 500 })
  }
}
