import { NextRequest, NextResponse } from 'next/server'
import { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  requireMerchant,
  resolveStoreIdsForPartner,
} from '@/lib/partner-auth'
import { deliveryOtpsMatch, generateDeliveryOtp } from '@/lib/delivery-otp'
import {
  notifyDeliveryPartnersJobAvailable,
  notifyOrderStatus,
  statusTimestampFields,
} from '@/lib/notifications'
import { releaseOrderWallet } from '@/lib/order-payment-lifecycle'
import { creditPendingCashback } from '@/lib/wallet'

const MERCHANT_ALLOWED: OrderStatus[] = [
  'ACCEPTED',
  'PREPARING',
  'READY',
]

const ADMIN_ALLOWED: OrderStatus[] = [
  'ACCEPTED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
]

const FORWARD: Record<string, OrderStatus[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
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

    const storeIds = await resolveStoreIdsForPartner(partner.access, request)
    if (storeIds.length === 0) {
      return NextResponse.json([])
    }

    const status = request.nextUrl.searchParams.get('status')
    const fullAccess = partner.access.fullAccess
    const orders = await prisma.order.findMany({
      where: {
        storeId: { in: storeIds },
        NOT: {
          AND: [{ paymentMethod: 'ONLINE' }, { paymentStatus: 'PENDING' }],
        },
        ...(status ? { status: status as OrderStatus } : {}),
        ...(fullAccess
          ? {}
          : {
              items: {
                some: {
                  product: { sellerId: partner.sellerId },
                },
              },
            }),
      },
      include: {
        store: { select: { id: true, slug: true, name: true } },
        user: {
          select: { name: true, email: true, phone: true },
        },
        deliveryPartner: {
          select: { id: true, name: true, phone: true, vehicleType: true },
        },
        address: {
          select: {
            street: true,
            apartment: true,
            landmark: true,
            city: true,
            state: true,
            pincode: true,
            latitude: true,
            longitude: true,
          },
        },
        items: {
          ...(fullAccess
            ? {}
            : { where: { product: { sellerId: partner.sellerId } } }),
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
                sellerId: true,
                pickupLatitude: true,
                pickupLongitude: true,
                pickupAddress: true,
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
        const canFulfill = fullAccess
          ? true
          : await orderOwnedSolelyBySeller(order.id, partner.sellerId!)
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
    const nextStatus = body.status
      ? (String(body.status) as OrderStatus)
      : null
    const fullAccess = partner.access.fullAccess

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    if (
      nextStatus &&
      !(fullAccess ? ADMIN_ALLOWED : MERCHANT_ALLOWED).includes(nextStatus)
    ) {
      return NextResponse.json(
        { error: 'Invalid orderId or status' },
        { status: 400 }
      )
    }

    const storeIds = await resolveStoreIdsForPartner(partner.access, request)
    const existing = await prisma.order.findFirst({
      where: {
        id: orderId,
        storeId: { in: storeIds },
        ...(fullAccess
          ? {}
          : {
              items: {
                some: { product: { sellerId: partner.sellerId } },
              },
            }),
      },
      select: {
        id: true,
        userId: true,
        orderNumber: true,
        status: true,
        deliveryOtp: true,
        storeId: true,
        deliveryPartnerId: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!fullAccess) {
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
    }

    const updateData: Record<string, unknown> = {}
    let issuedOtp: string | null = null
    let effectiveStatus = existing.status

    if (nextStatus) {
      if (fullAccess) {
        if (
          nextStatus === 'DELIVERED' &&
          existing.status !== 'DELIVERED'
        ) {
          if (!existing.deliveryOtp) {
            return NextResponse.json(
              {
                error:
                  'No delivery OTP on this order. Mark it Out for delivery first.',
              },
              { status: 400 }
            )
          }
          if (!deliveryOtpsMatch(existing.deliveryOtp, body.deliveryOtp)) {
            return NextResponse.json(
              { error: 'Invalid delivery OTP' },
              { status: 400 }
            )
          }
        }

        const allowedNext = FORWARD[existing.status] || []
        // Admin can jump more freely among forward statuses + cancel
        const adminOk =
          nextStatus === existing.status ||
          allowedNext.includes(nextStatus) ||
          nextStatus === 'CANCELLED' ||
          (existing.status === 'READY' && nextStatus === 'OUT_FOR_DELIVERY') ||
          (existing.status === 'OUT_FOR_DELIVERY' && nextStatus === 'DELIVERED')
        if (!adminOk && nextStatus !== existing.status) {
          // Still allow ACCEPTED→READY skip for admin convenience
          const looseOk =
            (existing.status === 'PENDING' && nextStatus === 'ACCEPTED') ||
            (existing.status === 'ACCEPTED' &&
              ['PREPARING', 'READY'].includes(nextStatus)) ||
            (existing.status === 'PREPARING' && nextStatus === 'READY')
          if (!looseOk) {
            return NextResponse.json(
              {
                error: `Cannot move from ${existing.status} to ${nextStatus}`,
              },
              { status: 400 }
            )
          }
        }
      } else {
        const allowedNext = FORWARD[existing.status]?.filter((s) =>
          MERCHANT_ALLOWED.includes(s)
        ) || []
        if (!allowedNext.includes(nextStatus)) {
          return NextResponse.json(
            {
              error: `Cannot move from ${existing.status} to ${nextStatus}`,
            },
            { status: 400 }
          )
        }
      }

      updateData.status = nextStatus
      Object.assign(updateData, statusTimestampFields(nextStatus))
      effectiveStatus = nextStatus

      if (nextStatus !== existing.status) {
        if (nextStatus === 'OUT_FOR_DELIVERY') {
          issuedOtp = generateDeliveryOtp()
          updateData.deliveryOtp = issuedOtp
          updateData.deliveryOtpCreatedAt = new Date()
        } else if (nextStatus === 'READY' && !existing.deliveryOtp) {
          issuedOtp = generateDeliveryOtp()
          updateData.deliveryOtp = issuedOtp
          updateData.deliveryOtpCreatedAt = new Date()
        }
      }
    }

    if (fullAccess && body.deliveryPartnerId !== undefined) {
      if (body.deliveryPartnerId === null || body.deliveryPartnerId === '') {
        updateData.deliveryPartnerId = null
      } else {
        const rider = await prisma.deliveryPartner.findUnique({
          where: { id: String(body.deliveryPartnerId) },
          select: { id: true },
        })
        if (!rider) {
          return NextResponse.json(
            { error: 'Delivery partner not found' },
            { status: 400 }
          )
        }
        updateData.deliveryPartnerId = rider.id
        if (
          (!nextStatus || nextStatus === existing.status) &&
          existing.status === 'READY'
        ) {
          updateData.status = 'OUT_FOR_DELIVERY'
          Object.assign(updateData, statusTimestampFields('OUT_FOR_DELIVERY'))
          effectiveStatus = 'OUT_FOR_DELIVERY'
          if (!existing.deliveryOtp) {
            issuedOtp = generateDeliveryOtp()
            updateData.deliveryOtp = issuedOtp
            updateData.deliveryOtpCreatedAt = new Date()
          }
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const order = await prisma.order.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        user: { select: { name: true, email: true, phone: true } },
        deliveryPartner: {
          select: { id: true, name: true, phone: true, vehicleType: true },
        },
        items: {
          include: {
            product: { select: { name: true, image: true } },
          },
        },
      },
    })

    if (effectiveStatus !== existing.status) {
      void notifyOrderStatus({
        userId: existing.userId,
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        status: effectiveStatus,
        storeId: existing.storeId,
        deliveryOtp: issuedOtp ?? undefined,
      }).catch((err) => console.error('notifyOrderStatus', err))

      if (effectiveStatus === 'READY') {
        void notifyDeliveryPartnersJobAvailable({
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          storeId: existing.storeId,
          excludeUserId: partner.userId,
        }).catch((err) => console.error('notifyDeliveryPartnersJobAvailable', err))
      }

      if (effectiveStatus === 'CANCELLED') {
        void releaseOrderWallet(existing.id).catch((err) =>
          console.error('releaseOrderWallet', err)
        )
      }

      if (effectiveStatus === 'DELIVERED') {
        void creditPendingCashback(existing.id).catch((err) =>
          console.error('creditPendingCashback', err)
        )
      }
    }

    return NextResponse.json({ ...order, canFulfill: true })
  } catch (error) {
    console.error('Partner merchant orders PATCH:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
