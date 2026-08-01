import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireDelivery,
  resolveStoreIdsForPartner,
} from '@/lib/partner-auth'

const orderInclude = {
  store: { select: { id: true, slug: true, name: true } },
  user: { select: { name: true, phone: true } },
  address: true,
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          image: true,
          pickupLatitude: true,
          pickupLongitude: true,
          pickupAddress: true,
        },
      },
    },
  },
} as const

/** Bearing degrees clockwise from north (0–360). */
function bearingDegrees(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δλ = toRad(lng2 - lng1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Online / offline + optional location. */
export async function POST(request: NextRequest) {
  try {
    const partner = await requireDelivery(request)
    if (!partner?.deliveryPartnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const action = String(body.action || '')

    if (action === 'online' || action === 'offline') {
      const updated = await prisma.deliveryPartner.update({
        where: { id: partner.deliveryPartnerId },
        data: {
          isAvailable: action === 'online',
          ...(typeof body.lat === 'number' ? { currentLat: body.lat } : {}),
          ...(typeof body.lng === 'number' ? { currentLng: body.lng } : {}),
        },
        select: {
          id: true,
          isAvailable: true,
          currentLat: true,
          currentLng: true,
          vehicleType: true,
          vehicleNumber: true,
        },
      })
      return NextResponse.json(updated)
    }

    if (action === 'location') {
      const lat = Number(body.lat)
      const lng = Number(body.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
      }

      const prev = await prisma.deliveryPartner.findUnique({
        where: { id: partner.deliveryPartnerId },
        select: { currentLat: true, currentLng: true, currentHeading: true },
      })

      // Prefer device compass/GPS heading; else derive from movement.
      let heading: number | null = null
      const rawHeading = Number(body.heading)
      if (Number.isFinite(rawHeading) && rawHeading >= 0 && rawHeading <= 360) {
        heading = rawHeading
      } else if (
        prev?.currentLat != null &&
        prev?.currentLng != null &&
        distanceMeters(prev.currentLat, prev.currentLng, lat, lng) >= 8
      ) {
        heading = bearingDegrees(prev.currentLat, prev.currentLng, lat, lng)
      } else if (prev?.currentHeading != null) {
        heading = prev.currentHeading
      }

      const updated = await prisma.deliveryPartner.update({
        where: { id: partner.deliveryPartnerId },
        data: {
          currentLat: lat,
          currentLng: lng,
          ...(heading != null ? { currentHeading: heading } : {}),
        },
        select: {
          id: true,
          isAvailable: true,
          currentLat: true,
          currentLng: true,
          currentHeading: true,
        },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Delivery status POST:', error)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}

/** Open pool of READY unassigned delivery orders. */
export async function GET(request: NextRequest) {
  try {
    const partner = await requireDelivery(request)
    if (!partner?.deliveryPartnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const view = request.nextUrl.searchParams.get('view') || 'pool'
    const storeIds = await resolveStoreIdsForPartner(partner.access, request)

    if (view === 'active') {
      const active = await prisma.order.findFirst({
        where: {
          deliveryPartnerId: partner.deliveryPartnerId,
          status: 'OUT_FOR_DELIVERY',
        },
        include: orderInclude,
        orderBy: { outForDeliveryAt: 'desc' },
      })
      return NextResponse.json(active)
    }

    if (view === 'history') {
      const history = await prisma.order.findMany({
        where: {
          deliveryPartnerId: partner.deliveryPartnerId,
          status: 'DELIVERED',
          ...(storeIds.length ? { storeId: { in: storeIds } } : {}),
        },
        include: orderInclude,
        orderBy: { deliveredAt: 'desc' },
        take: 50,
      })
      return NextResponse.json(history)
    }

    // pool
    if (storeIds.length === 0) {
      return NextResponse.json([])
    }

    const pool = await prisma.order.findMany({
      where: {
        storeId: { in: storeIds },
        status: 'READY',
        fulfillmentType: 'DELIVERY',
        deliveryPartnerId: null,
        NOT: {
          AND: [{ paymentMethod: 'ONLINE' }, { paymentStatus: 'PENDING' }],
        },
      },
      include: orderInclude,
      orderBy: { placedAt: 'asc' },
      take: 50,
    })

    return NextResponse.json(pool)
  } catch (error) {
    console.error('Delivery GET:', error)
    return NextResponse.json({ error: 'Failed to load deliveries' }, { status: 500 })
  }
}
