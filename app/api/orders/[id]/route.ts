import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LEGACY_PRODUCT_SELECT } from '@/lib/product-db'
import { releaseOrderWallet } from '@/lib/order-payment-lifecycle'
import { resolveUserId } from '@/lib/request-auth'
import { resolveStoreContext } from '@/lib/store-context'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const storeContext = await resolveStoreContext(request)
    if (!storeContext) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const { id } = await params

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: LEGACY_PRODUCT_SELECT,
            },
          },
        },
        address: true,
        recipient: true,
        giftWrap: true,
        occasion: true,
        deliveryPartner: {
          select: {
            id: true,
            name: true,
            phone: true,
            vehicleType: true,
            vehicleNumber: true,
            currentLat: true,
            currentLng: true,
            currentHeading: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Verify order belongs to user
    if (order.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    if (order.storeId !== storeContext.store.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Live rider GPS while assigned and not finished/cancelled.
    const liveStatuses = new Set(['READY', 'OUT_FOR_DELIVERY'])
    const partner = order.deliveryPartner
    const canShareLive =
      !!partner &&
      liveStatuses.has(order.status) &&
      partner.currentLat != null &&
      partner.currentLng != null

    const { deliveryPartner, ...rest } = order
    return NextResponse.json({
      order: {
        ...rest,
        deliveryPartner: deliveryPartner
          ? {
              id: deliveryPartner.id,
              name: deliveryPartner.name,
              phone: canShareLive && deliveryPartner.phone
                ? `••••${String(deliveryPartner.phone).slice(-4)}`
                : null,
              vehicleType: deliveryPartner.vehicleType,
              vehicleNumber: deliveryPartner.vehicleNumber,
              currentLat: canShareLive ? deliveryPartner.currentLat : null,
              currentLng: canShareLive ? deliveryPartner.currentLng : null,
              currentHeading: canShareLive
                ? deliveryPartner.currentHeading
                : null,
            }
          : null,
      },
    })
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    )
  }
}

const CANCELLABLE_STATUSES = ['PENDING', 'ACCEPTED', 'PREPARING']

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const storeContext = await resolveStoreContext(request)
    if (!storeContext) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action ?? '').toLowerCase()

    if (action !== 'cancel') {
      return NextResponse.json(
        { error: 'Unsupported action' },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, userId: true, storeId: true, status: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (order.storeId !== storeContext.store.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return NextResponse.json(
        { error: 'This order cannot be cancelled anymore' },
        { status: 400 }
      )
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
      include: {
        items: {
          include: {
            product: {
              select: LEGACY_PRODUCT_SELECT,
            },
          },
        },
        address: true,
        recipient: true,
        giftWrap: true,
        occasion: true,
      },
    })

    await releaseOrderWallet(id)

    return NextResponse.json({ order: updated })
  } catch (error) {
    console.error('Error cancelling order:', error)
    return NextResponse.json(
      { error: 'Failed to cancel order' },
      { status: 500 }
    )
  }
}
