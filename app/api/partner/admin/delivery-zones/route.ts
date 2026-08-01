import { NextRequest, NextResponse } from 'next/server'
import {
  normalizeDeliveryZones,
  type DeliveryZone,
} from '@/lib/app-settings-schema'
import {
  requirePartnerAdmin,
  resolvePartnerStoreContext,
} from '@/lib/partner-auth'
import { prisma } from '@/lib/prisma'
import { redis, REDIS_KEYS } from '@/lib/redis'

async function ensureDeliveryZonesColumn() {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "deliveryZones" JSONB`
    )
  } catch {
    // ignore — column may already exist or DB may not support IF NOT EXISTS
  }
}

async function loadZones(storeId: string): Promise<DeliveryZone[]> {
  try {
    const rows = await prisma.$queryRaw<Array<{ deliveryZones: unknown }>>`
      SELECT "deliveryZones" FROM "AppSettings" WHERE "storeId" = ${storeId} LIMIT 1
    `
    return normalizeDeliveryZones(rows[0]?.deliveryZones)
  } catch {
    return []
  }
}

async function saveZones(storeId: string, zones: DeliveryZone[]) {
  await ensureDeliveryZonesColumn()
  await prisma.$executeRawUnsafe(
    `UPDATE "AppSettings" SET "deliveryZones" = $1::jsonb WHERE "storeId" = $2`,
    JSON.stringify(zones),
    storeId
  )
}

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
      select: {
        mapLatitude: true,
        mapLongitude: true,
        storeAddress: true,
      },
    })
    const zones = await loadZones(ctx.store.id)

    return NextResponse.json({
      store: ctx.store,
      mapLatitude: settings?.mapLatitude ?? 27.7172,
      mapLongitude: settings?.mapLongitude ?? 85.324,
      storeAddress: settings?.storeAddress ?? '',
      deliveryZones: zones,
    })
  } catch (error) {
    console.error('Partner admin delivery-zones GET:', error)
    return NextResponse.json({ error: 'Failed to load zones' }, { status: 500 })
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
    const zones = normalizeDeliveryZones(body.deliveryZones)

    await prisma.appSettings.upsert({
      where: { storeId: ctx.store.id },
      update: {},
      create: { storeId: ctx.store.id },
    })
    await saveZones(ctx.store.id, zones)
    await redis.del(REDIS_KEYS.APP_SETTINGS(ctx.slug), REDIS_KEYS.HOME(ctx.slug))

    return NextResponse.json({ deliveryZones: zones })
  } catch (error) {
    console.error('Partner admin delivery-zones PATCH:', error)
    return NextResponse.json({ error: 'Failed to save zones' }, { status: 500 })
  }
}
