import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  normalizeHomeSections,
  removeBannerCarouselFromLayout,
  upsertBannerCarouselInLayout,
} from '@/lib/app-settings-schema'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

async function syncLayoutForStore(
  storeId: string,
  storeSlug: string,
  mutate: (layout: ReturnType<typeof normalizeHomeSections>) => ReturnType<typeof normalizeHomeSections>
) {
  const settings = await prisma.appSettings.findUnique({
    where: { storeId },
    select: { id: true, homeSectionLayout: true },
  })
  if (!settings) return

  const nextLayout = mutate(normalizeHomeSections(settings.homeSectionLayout))
  await prisma.appSettings.update({
    where: { id: settings.id },
    data: { homeSectionLayout: nextLayout },
  })
  await redis.del(REDIS_KEYS.APP_SETTINGS(storeSlug))
  await redis.del(REDIS_KEYS.HOME(storeSlug))
}

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    const sections = await prisma.bannerSection.findMany({
      where: { storeId: storeContext.store.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { banners: true } },
      },
    })

    return NextResponse.json({ sections })
  } catch (error) {
    console.error('Error fetching banner sections:', error)
    return NextResponse.json({ error: 'Failed to fetch banner sections' }, { status: 500 })
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
    const title = String(body?.title || '').trim()
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

    const maxOrder = await prisma.bannerSection.aggregate({
      where: { storeId: storeContext.store.id },
      _max: { order: true },
    })

    const heightRaw = Number(body?.height)
    const height = Number.isFinite(heightRaw) ? Math.min(400, Math.max(80, Math.round(heightRaw))) : 160

    const section = await prisma.bannerSection.create({
      data: {
        storeId: storeContext.store.id,
        title: title.slice(0, 80),
        subtitle: String(body?.subtitle || '').trim().slice(0, 120) || null,
        height,
        order: typeof body?.order === 'number' ? body.order : (maxOrder._max.order ?? -1) + 1,
        isActive: body?.isActive !== false,
      },
    })

    await syncLayoutForStore(storeContext.store.id, storeContext.slug, (layout) =>
      upsertBannerCarouselInLayout(layout, section)
    )
    await redis.del(REDIS_KEYS.HOME_BANNERS(storeContext.slug))

    return NextResponse.json({ section }, { status: 201 })
  } catch (error) {
    console.error('Error creating banner section:', error)
    return NextResponse.json({ error: 'Failed to create banner section' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    const body = await request.json()

    // Bulk reorder: { order: [{ id, order }] }
    if (Array.isArray(body?.order)) {
      const updates = body.order
        .map((row: { id?: unknown; order?: unknown }) => ({
          id: String(row?.id || '').trim(),
          order: Math.round(Number(row?.order)),
        }))
        .filter((row: { id: string; order: number }) => row.id && Number.isFinite(row.order))

      await prisma.$transaction(
        updates.map((row: { id: string; order: number }) =>
          prisma.bannerSection.updateMany({
            where: { id: row.id, storeId: storeContext.store.id },
            data: { order: row.order },
          })
        )
      )
      await redis.del(REDIS_KEYS.HOME_BANNERS(storeContext.slug))
      return NextResponse.json({ ok: true })
    }

    const id = String(body?.id || '').trim()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const existing = await prisma.bannerSection.findFirst({
      where: { id, storeId: storeContext.store.id },
    })
    if (!existing) return NextResponse.json({ error: 'Section not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (body.title !== undefined) {
      const title = String(body.title || '').trim()
      if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
      data.title = title.slice(0, 80)
    }
    if (body.subtitle !== undefined) {
      data.subtitle = String(body.subtitle || '').trim().slice(0, 120) || null
    }
    if (body.height !== undefined) {
      const heightRaw = Number(body.height)
      if (!Number.isFinite(heightRaw)) {
        return NextResponse.json({ error: 'invalid height' }, { status: 400 })
      }
      data.height = Math.min(400, Math.max(80, Math.round(heightRaw)))
    }
    if (body.order !== undefined) data.order = Math.round(Number(body.order)) || 0
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)

    const section = await prisma.bannerSection.update({
      where: { id },
      data,
    })

    await syncLayoutForStore(storeContext.store.id, storeContext.slug, (layout) => {
      let next = upsertBannerCarouselInLayout(layout, section)
      if (section.isActive === false) {
        next = next.map((s) =>
          s.id === 'bannerCarousel' && s.key === section.id ? { ...s, visible: false } : s
        )
      }
      return next
    })
    await redis.del(REDIS_KEYS.HOME_BANNERS(storeContext.slug))

    return NextResponse.json({ section })
  } catch (error) {
    console.error('Error updating banner section:', error)
    return NextResponse.json({ error: 'Failed to update banner section' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const id = String(searchParams.get('id') || '').trim()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const result = await prisma.bannerSection.deleteMany({
      where: { id, storeId: storeContext.store.id },
    })
    if (result.count === 0) return NextResponse.json({ error: 'Section not found' }, { status: 404 })

    await syncLayoutForStore(storeContext.store.id, storeContext.slug, (layout) =>
      removeBannerCarouselFromLayout(layout, id)
    )
    await redis.del(REDIS_KEYS.HOME_BANNERS(storeContext.slug))

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting banner section:', error)
    return NextResponse.json({ error: 'Failed to delete banner section' }, { status: 500 })
  }
}
