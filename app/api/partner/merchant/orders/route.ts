import { NextRequest, NextResponse } from 'next/server'
import { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  requireMerchant,
  resolveStoreIdsForPartner,
} from '@/lib/partner-auth'
import { generateDeliveryOtp } from '@/lib/delivery-otp'
import {
  notifyOrderStatus,
  statusTimestampFields,
} from '@/lib/notifications'

const MERCHANT_ALLOWED: OrderStatus[] = [
  'ACCEPTED',
  'PREPARING',
  'READY',
]

const FORWARD: Record<string, OrderStatus[]> = {
  PENDING: ['ACCEPTED'],
  ACCEPTED: ['PREPARING'],
  PREPARING: ['READY'],
}

async function orderOwnedSolelyBySeller(orderId: string, sellerId: string) {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: {
      product: { select: { sellerId: true } },
    },
  })
  if (items.length === 0) return false
  return items.every((i) => i.product.sellerId === sellerId)
}

export async function GET(request: NextRequest) {
  try {
    const partner = await requireMerchant(request)
    if (!partner?.sellerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeIds = await resolveStoreIdsForPartner(partner.access)
    if (storeIds.length === 0) {
      return NextResponse.json([])
    }

    const status = request.nextUrl.searchParams.get('status')
    const orders = await prisma.order.findMany({
      where: {
        storeId: { in: storeIds },
        NOT: {
          AND: [{ paymentMethod: 'ONLINE' }, { paymentStatus: 'PENDING' }],
        },
        ...(status ? { status: status as OrderStatus } : {}),
        items: {
          some: {
            product: { sellerId: partner.sellerId },
          },
        },
      },
      include: {
        store: { select: { id: true, slug: true, name: true } },
        user: {
          select: { name: true, email: true, phone: true },
        },
        address: {
          select: {
            street: true,
            apartment: true,
            city: true,
            state: true,
            pincode: true,
            latitude: true,
            longitude: true,
          },
        },
        items: {
          where: { product: { sellerId: partner.sellerId } },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
                sellerId: true,
              },
            },
          },
        },
      },
      orderBy: { placedAt: 'desc' },
      take: 100,
    })

    const withFlags = await Promise.all(
      orders.map(async (order) => {
        const canFulfill = await orderOwnedSolelyBySeller(
          order.id,
          partner.sellerId!
        )
        return { ...order, canFulfill }
      })
    )

    return NextResponse.json(withFlags)
  } catch (error) {
    console.error('Partner merchant orders GET:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const partner = await requireMerchant(request)
    if (!partner?.sellerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const orderId = String(body.orderId || body.id || '')
    const nextStatus = String(body.status || '') as OrderStatus

    if (!orderId || !MERCHANT_ALLOWED.includes(nextStatus)) {
      return NextResponse.json(
        { error: 'Invalid orderId or status' },
        { status: 400 }
      )
    }

    const storeIds = await resolveStoreIdsForPartner(partner.access)
    const existing = await prisma.order.findFirst({
      where: {
        id: orderId,
        storeId: { in: storeIds },
        items: { some: { product: { sellerId: partner.sellerId } } },
      },
      select: {
        id: true,
        userId: true,
        orderNumber: true,
        status: true,
        deliveryOtp: true,
        storeId: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const canFulfill = await orderOwnedSolelyBySeller(
      existing.id,
      partner.sellerId
    )
    if (!canFulfill) {
      return NextResponse.json(
        {
          error:
            'This order has items from other sellers. Ask admin to update status.',
        },
        { status: 403 }
      )
    }

    const allowedNext = FORWARD[existing.status] || []
    if (!allowedNext.includes(nextStatus)) {
      return NextResponse.json(
        {
          error: `Cannot move from ${existing.status} to ${nextStatus}`,
        },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {
      status: nextStatus,
      ...statusTimestampFields(nextStatus),
    }

    let issuedOtp: string | null = null
    if (nextStatus === 'READY' && !existing.deliveryOtp) {
      issuedOtp = generateDeliveryOtp()
      updateData.deliveryOtp = issuedOtp
      updateData.deliveryOtpCreatedAt = new Date()
    }

    const order = await prisma.order.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        user: { select: { name: true, email: true, phone: true } },
        items: {
          include: {
            product: { select: { name: true, image: true } },
          },
        },
      },
    })

    if (nextStatus !== existing.status) {
      void notifyOrderStatus({
        userId: existing.userId,
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        status: nextStatus,
        storeId: existing.storeId,
        deliveryOtp: issuedOtp,
      }).catch((err) => console.error('notifyOrderStatus', err))
    }

    return NextResponse.json({ ...order, canFulfill: true })
  } catch (error) {
    console.error('Partner merchant orders PATCH:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
