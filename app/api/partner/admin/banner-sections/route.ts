import { NextRequest, NextResponse } from 'next/server'
import {
  normalizeHomeSections,
  upsertBannerCarouselInLayout,
} from '@/lib/app-settings-schema'
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

    const sections = await prisma.bannerSection.findMany({
      where: { storeId: ctx.store.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { banners: true } } },
    })
    return NextResponse.json({ sections })
  } catch (error) {
    console.error('Partner admin banner-sections GET:', error)
    return NextResponse.json({ error: 'Failed to fetch sections' }, { status: 500 })
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
    const title = String(body?.title || '').trim()
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const maxOrder = await prisma.bannerSection.aggregate({
      where: { storeId: ctx.store.id },
      _max: { order: true },
    })
    const heightRaw = Number(body?.height)
    const height = Number.isFinite(heightRaw)
      ? Math.min(400, Math.max(80, Math.round(heightRaw)))
      : 160

    const section = await prisma.bannerSection.create({
      data: {
        storeId: ctx.store.id,
        title: title.slice(0, 80),
        subtitle: String(body?.subtitle || '').trim().slice(0, 120) || null,
        height,
        order: (maxOrder._max.order ?? -1) + 1,
        isActive: body?.isActive !== false,
      },
    })

    const settings = await prisma.appSettings.findUnique({
      where: { storeId: ctx.store.id },
      select: { id: true, homeSectionLayout: true },
    })
    if (settings) {
      const nextLayout = upsertBannerCarouselInLayout(
        normalizeHomeSections(settings.homeSectionLayout),
        {
          id: section.id,
          title: section.title,
          subtitle: section.subtitle,
        }
      )
      await prisma.appSettings.update({
        where: { id: settings.id },
        data: { homeSectionLayout: nextLayout },
      })
    }

    await redis.del(
      REDIS_KEYS.APP_SETTINGS(ctx.slug),
      REDIS_KEYS.HOME(ctx.slug),
      REDIS_KEYS.HOME_BANNERS(ctx.slug)
    )

    return NextResponse.json(section)
  } catch (error) {
    console.error('Partner admin banner-sections POST:', error)
    return NextResponse.json({ error: 'Failed to create section' }, { status: 500 })
  }
}
