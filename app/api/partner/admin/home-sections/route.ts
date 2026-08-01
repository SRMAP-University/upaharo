import { NextRequest, NextResponse } from 'next/server'
import { normalizeHomeSections } from '@/lib/app-settings-schema'
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

    const settings = await prisma.appSettings.findUnique({
      where: { storeId: ctx.store.id },
      select: { homeSectionLayout: true },
    })

    return NextResponse.json({
      homeSectionLayout: normalizeHomeSections(settings?.homeSectionLayout),
    })
  } catch (error) {
    console.error('Partner admin home-sections GET:', error)
    return NextResponse.json({ error: 'Failed to load sections' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
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
    const homeSectionLayout = normalizeHomeSections(body.homeSectionLayout)

    await prisma.appSettings.upsert({
      where: { storeId: ctx.store.id },
      update: { homeSectionLayout },
      create: { storeId: ctx.store.id, homeSectionLayout },
    })
    await redis.del(REDIS_KEYS.APP_SETTINGS(ctx.slug), REDIS_KEYS.HOME(ctx.slug))

    return NextResponse.json({ homeSectionLayout })
  } catch (error) {
    console.error('Partner admin home-sections PATCH:', error)
    return NextResponse.json({ error: 'Failed to save sections' }, { status: 500 })
  }
}
